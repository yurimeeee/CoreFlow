import { NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/lib/firebaseAdmin";
import type { ApprovalDoc, LeaveDoc, NoticeDoc } from "@/lib/groupware/firestore";
import type { UserDoc } from "@/types/user";

/**
 * Slack / Jandi Incoming Webhook 릴레이.
 *
 * 두 서비스 모두 브라우저에서 직접 fetch 하면 CORS 로 막히기 때문에, 이
 * 서버 라우트가 대신 POST 합니다.
 *
 * 웹훅 URL은 클라이언트가 보내지 않습니다 — 관리자만 읽을 수 있는
 * integrationSecrets/main 에서 서버가 직접 읽습니다.
 *
 * 메시지 문구도 클라이언트가 보내지 않습니다. 예전엔 구성원 누구나 임의의
 * text 를 보낼 수 있어서 "[공지] 대표: 오늘 휴무" 같은 메시지를 회사 채널에
 * 그대로 올릴 수 있었습니다. 이제 호출자는 { event, id } 만 보내고, 서버가
 * 해당 문서를 읽어 "호출자가 실제로 그 일을 했는지"(공지 작성자 · 결재 기안자 ·
 * 결재한 사람 · 연차 신청자 · 승인한 관리자)를 확인한 뒤 문서 내용으로 문구를
 * 만듭니다. 같은 이벤트는 notifyLog 에 기록해 한 번만 보냅니다(재호출 도배 방지).
 *
 * 설정 화면의 "테스트 전송"은 관리자만, 문구는 서버 고정입니다.
 */

const ALLOWED_HOSTS: Record<Service, string[]> = {
  slack: ["hooks.slack.com"],
  jandi: ["wh.jandi.com"],
};

const TEST_TEXT =
  "CoreFlow 연동 테스트 메시지입니다. 이 메시지가 보이면 연동이 정상 동작합니다. ✅";

type Service = "slack" | "jandi";

export type NotifyEvent =
  | "notice_published"
  | "approval_submitted"
  | "approval_decided"
  | "leave_requested"
  | "leave_decided";

interface NotifyBody {
  event?: string;
  id?: string;
  /** 설정 화면의 테스트 전송 — 관리자만, 저장 전 URL로 바로 보내봅니다. */
  test?: { service?: string; webhookUrl?: string };
}

/** 보낼 메시지 — 보낼 이유가 없으면(조건 불일치) null */
interface Message {
  service: Service;
  /** notifyLog 문서 id — 같은 값이면 한 번만 보냅니다 */
  key: string;
  text: string;
  title: string;
}

class Forbidden extends Error {}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isAdminUser(u: UserDoc | undefined) {
  return u?.status === "ACTIVE" && (u.role === "ADMIN" || u.role === "SUPER_ADMIN");
}

/** 알림에 쓰는 이름 — 클라이언트(useCurrentUser)와 같은 "이름 직급" 형식 */
function displayName(u: UserDoc | undefined) {
  if (!u) return "알 수 없음";
  return u.position ? `${u.name} ${u.position}` : u.name;
}

async function getUser(db: Firestore, uid: string | null | undefined) {
  if (!uid) return undefined;
  return (await db.doc(`users/${uid}`).get()).data() as UserDoc | undefined;
}

async function getDocData<T>(db: Firestore, path: string) {
  const snap = await db.doc(path).get();
  if (!snap.exists) throw new Forbidden();
  return snap.data() as T;
}

/**
 * 이벤트 → 메시지. 문서가 없거나 호출자가 그 일을 한 사람이 아니면 Forbidden.
 * 문구는 예전 클라이언트가 만들던 것과 같은 형식입니다.
 */
async function buildMessage(
  db: Firestore,
  event: NotifyEvent,
  id: string,
  uid: string,
  me: UserDoc,
): Promise<Message> {
  switch (event) {
    case "notice_published": {
      const n = await getDocData<NoticeDoc>(db, `notices/${id}`);
      const mine = n.authorUid ? n.authorUid === uid : isAdminUser(me);
      if (!mine || n.status === "draft") throw new Forbidden();
      return {
        service: "slack",
        key: `notice_${id}`,
        text: `${n.pinned ? "📌 " : ""}[공지] ${n.title}\n${displayName(me)} · ${(n.body ?? "").slice(0, 140)}`,
        title: n.title,
      };
    }

    case "approval_submitted": {
      const a = await getDocData<ApprovalDoc>(db, `approvals/${id}`);
      if (a.authorUid !== uid || a.bucket !== "pending") throw new Forbidden();
      const seq = (a.approverSeq ?? []).filter(Boolean);
      const last = await getUser(db, seq[seq.length - 1]);
      return {
        service: "slack",
        key: `approval_${id}_submitted`,
        text: `[결재 상신] ${a.title} (${id})\n기안자 ${displayName(me)} · 결재자 ${last ? displayName(last) : "미지정"}`,
        title: a.title,
      };
    }

    case "approval_decided": {
      const a = await getDocData<ApprovalDoc>(db, `approvals/${id}`);
      // 호출자가 결재란에서 실제로 승인·반려한 단계가 있어야 합니다
      const mine = (a.line ?? []).find(
        (l) => l.kind !== "기안" && l.uid === uid && (l.state === "승인" || l.state === "반려"),
      );
      if (!mine) throw new Forbidden();
      const label =
        a.status === "Approved" ? "승인" : a.status === "Rejected" ? "반려" : "결재 진행";
      return {
        service: "slack",
        key: `approval_${id}_${uid}_${mine.state}`,
        text: `[결재 ${label}] ${a.title || id} (${id}) · ${me.name}`,
        title: a.title || id,
      };
    }

    case "leave_requested": {
      const l = await getDocData<LeaveDoc>(db, `leaves/${id}`);
      if (l.uid !== uid || l.status !== "대기") throw new Forbidden();
      return {
        service: "jandi",
        key: `leave_${id}_requested`,
        text: `[근태] ${me.name}님이 ${l.kind}를 신청했습니다. (${l.start} ~ ${l.end})\n사유: ${l.reason}`,
        title: `${l.kind} 신청`,
      };
    }

    case "leave_decided": {
      if (!isAdminUser(me)) throw new Forbidden();
      const l = await getDocData<LeaveDoc>(db, `leaves/${id}`);
      if (l.status !== "승인" && l.status !== "반려") throw new Forbidden();
      const who = await getUser(db, l.uid);
      return {
        service: "jandi",
        key: `leave_${id}_${l.status}`,
        text: `[근태] ${who?.name ?? l.who}님의 ${l.kind} 신청이 ${l.status}되었습니다. (${l.start} ~ ${l.end})`,
        title: `${l.kind} ${l.status}`,
      };
    }
  }
}

const EVENTS: NotifyEvent[] = [
  "notice_published",
  "approval_submitted",
  "approval_decided",
  "leave_requested",
  "leave_decided",
];

async function post(service: Service, webhookUrl: string, text: string, title?: string) {
  let url: URL;
  try {
    url = new URL(webhookUrl);
  } catch {
    return fail("invalid_url", 400);
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS[service].includes(url.hostname)) {
    return fail("host_not_allowed", 400);
  }

  const payload =
    service === "slack"
      ? { text }
      : {
          body: text,
          connectColor: "#4F46E5",
          connectInfo: title
            ? [{ title: title.slice(0, 200), description: "" }]
            : [],
        };

  try {
    const upstream = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(service === "jandi"
          ? { Accept: "application/vnd.tosslab.jandi-v2+json" }
          : {}),
      },
      body: JSON.stringify(payload),
    });
    // 상대 서버의 응답 본문은 돌려주지 않습니다 — 상태 코드만으로 충분합니다
    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: "upstream_error", status: upstream.status },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return fail("network_error", 502);
  }
}

export async function POST(req: Request) {
  const admin = firebaseAdmin();
  if (!admin) return fail("not_configured", 503);

  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fail("unauthenticated", 401);
  let uid: string;
  let tokenTwoFactorId: unknown;
  try {
    const decoded = await admin.auth.verifyIdToken(token);
    uid = decoded.uid;
    tokenTwoFactorId = decoded.twoFactorId;
  } catch {
    return fail("unauthenticated", 401);
  }

  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }

  const db = admin.db;
  // firestore.rules 의 isMember()/isAdmin() 과 같은 기준 (2FA 통과 포함)
  const me = await getUser(db, uid);
  if (me?.status !== "ACTIVE") return fail("forbidden", 403);
  if (me.twoFactorId && tokenTwoFactorId !== me.twoFactorId) return fail("forbidden", 403);

  if (body.test) {
    const { service, webhookUrl } = body.test;
    if (!isAdminUser(me)) return fail("forbidden", 403);
    if (service !== "slack" && service !== "jandi") return fail("unsupported_service", 400);
    if (typeof webhookUrl !== "string") return fail("invalid_body", 400);
    return post(service, webhookUrl, TEST_TEXT, "CoreFlow 연동 테스트");
  }

  const event = body.event as NotifyEvent;
  const id = body.id;
  if (!EVENTS.includes(event)) return fail("unsupported_event", 400);
  if (typeof id !== "string" || !/^[\w.-]{1,128}$/.test(id)) return fail("invalid_body", 400);

  let msg: Message;
  try {
    msg = await buildMessage(db, event, id, uid, me);
  } catch (e) {
    if (e instanceof Forbidden) return fail("forbidden", 403);
    return fail("internal", 500);
  }

  const ws = (await db.doc("workspace/main").get()).data();
  if (!ws?.integrations?.[msg.service]?.on) {
    return NextResponse.json({ ok: false, error: "disabled" });
  }
  const secrets = (await db.doc("integrationSecrets/main").get()).data();
  const webhookUrl: string | undefined = secrets?.[msg.service]?.webhookUrl;
  if (!webhookUrl) return NextResponse.json({ ok: false, error: "disabled" });

  // 같은 이벤트는 한 번만 — create() 는 이미 있으면 실패합니다. 전송에
  // 실패하면 기록을 지워 다시 시도할 수 있게 합니다.
  const logRef = db.doc(`notifyLog/${msg.key}`);
  try {
    await logRef.create({ event, id, uid, at: FieldValue.serverTimestamp() });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  const res = await post(msg.service, webhookUrl, msg.text, msg.title);
  if (res.status !== 200) await logRef.delete().catch(() => {});
  return res;
}
