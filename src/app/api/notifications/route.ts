import { NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/lib/firebaseAdmin";
import type { ApprovalDoc, LeaveDoc, NoticeDoc, TaskDoc } from "@/lib/groupware/firestore";
import type { UserDoc } from "@/types/user";

/**
 * 알림 센터 받은편지함 — users/{받는 사람}/inbox/{key}.
 *
 * 남의 받은편지함에 클라이언트가 직접 쓰게 하면 아무나 "결재가 승인됐습니다"
 * 같은 가짜 알림을 보낼 수 있습니다. 그래서 웹훅 릴레이(/api/integrations/
 * notify)와 같은 방식으로, 호출자는 { event, id } 만 보내고 서버가 문서를
 * 읽어 "호출자가 실제로 그 일을 했는지" 확인한 뒤 받는 사람과 문구를 정합니다.
 * key 가 같으면 create() 가 실패해 같은 알림은 한 번만 쌓입니다.
 *
 * 받는 사람의 설정(gwSettings.toggles)에서 해당 서비스 내 알림을 끈 경우엔
 * 쓰지 않습니다. 결재 차례·안 읽은 공지는 상태에서 바로 계산되므로
 * (useNotifications) 여기서 만들지 않습니다.
 *
 * - approval_decided  결재자가 승인·반려 → 기안자 (대리 결재면 원래 결재자도)
 * - leave_decided     관리자가 연차 승인·반려 → 신청자
 * - task_assigned     만든 사람·관리자가 담당자 지정 → 담당자
 * - comment_added     댓글 작성 → 문서 관계자 + @이름 멘션(Task·공지만)
 *   id 는 "tasks:{id}:{댓글 id}" 형식 (approvals·notices 도 같음)
 */

export type InboxEvent = "approval_decided" | "leave_decided" | "task_assigned" | "comment_added";

const EVENTS: InboxEvent[] = ["approval_decided", "leave_decided", "task_assigned", "comment_added"];

export type InboxCat = "결재" | "근태" | "Task" | "공지";

/** 받는 사람이 끌 수 있는 서비스 내 알림 토글 (src/lib/groupware/data.ts NOTIFY_GROUPS) */
type ToggleKey = "inboxApproval" | "inboxAttendance" | "inboxMention";

interface Item {
  to: string;
  key: string;
  toggle: ToggleKey;
  cat: InboxCat;
  title: string;
  desc: string;
  href: string;
  icon: string;
}

const PARENTS = {
  tasks: { cat: "Task", href: () => "/tasks", mentions: true },
  notices: { cat: "공지", href: (id: string) => `/notice/${id}`, mentions: true },
  // 결재 문서는 관계자만 열람할 수 있어 멘션으로 바깥 사람에게 제목을 알리지 않습니다
  approvals: { cat: "결재", href: (id: string) => `/approval/${id}`, mentions: false },
} as const;

const MAX_MENTIONS = 10;

class Forbidden extends Error {}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isAdminUser(u: UserDoc | undefined) {
  return u?.status === "ACTIVE" && (u.role === "ADMIN" || u.role === "SUPER_ADMIN");
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

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 댓글 본문의 @이름 — 공백·문장부호 전까지를 이름으로 봅니다 */
export function mentionedNames(body: string): string[] {
  const names = new Set<string>();
  for (const m of body.matchAll(/@([^\s@,.!?;:()]{1,30})/g)) names.add(m[1]);
  return [...names].slice(0, MAX_MENTIONS);
}

async function buildItems(db: Firestore, event: InboxEvent, id: string, uid: string, me: UserDoc): Promise<Item[]> {
  switch (event) {
    case "approval_decided": {
      const a = await getDocData<ApprovalDoc>(db, `approvals/${id}`);
      // 위임받아 대신 처리한 단계는 proxyUid 가 실제 처리한 사람입니다
      const mine = (a.line ?? []).find(
        (l) =>
          l.kind !== "기안" &&
          (l.proxyUid ? l.proxyUid === uid : l.uid === uid) &&
          (l.state === "승인" || l.state === "반려"),
      );
      if (!mine || !a.authorUid) throw new Forbidden();
      const proxy = !!mine.proxyUid;
      const verb = `${proxy ? "대리 " : ""}${mine.state}`;
      const label = a.status === "Approved" ? "최종 승인" : a.status === "Rejected" ? "반려" : `${me.name}님 ${verb}`;
      const href = `/approval/${id}`;
      const icon = a.status === "Rejected" ? "CircleX" : "CircleCheck";
      const items: Item[] = [
        {
          to: a.authorUid,
          key: `ap_${id}_${uid}_${mine.state}`,
          toggle: "inboxApproval",
          cat: "결재",
          title: `결재 ${label} · ${a.title || id}`,
          desc: a.status === "In Progress" ? "다음 결재자에게 넘어갔습니다" : `${me.name} ${me.position ?? ""}`.trim(),
          href,
          icon,
        },
      ];
      // 자리를 비운 원래 결재자에게도 누가 대신 처리했는지 알립니다
      if (proxy && mine.uid) {
        items.push({
          to: mine.uid,
          key: `ap_${id}_${uid}_${mine.state}`,
          toggle: "inboxApproval",
          cat: "결재",
          title: `${me.name}님이 ${verb}했습니다 · ${a.title || id}`,
          desc: "위임한 결재를 대신 처리했습니다",
          href,
          icon,
        });
      }
      return items;
    }

    case "leave_decided": {
      if (!isAdminUser(me)) throw new Forbidden();
      const l = await getDocData<LeaveDoc>(db, `leaves/${id}`);
      if (l.status !== "승인" && l.status !== "반려") throw new Forbidden();
      return [
        {
          to: l.uid,
          key: `lv_${id}_${l.status}`,
          toggle: "inboxAttendance",
          cat: "근태",
          title: `${l.kind} 신청이 ${l.status}되었습니다`,
          desc: l.end && l.end !== l.start ? `${l.start} ~ ${l.end}` : l.start,
          href: "/attendance",
          icon: l.status === "반려" ? "CircleX" : "CircleCheck",
        },
      ];
    }

    case "task_assigned": {
      const t = await getDocData<TaskDoc>(db, `tasks/${id}`);
      // 담당자 지정은 카드를 만든 사람이나 관리자가 합니다
      if (t.createdBy !== uid && !isAdminUser(me)) throw new Forbidden();
      if (!t.assigneeId) return [];
      return [
        {
          to: t.assigneeId,
          key: `task_${id}_${t.assigneeId}`,
          toggle: "inboxMention",
          cat: "Task",
          title: `Task 담당자로 지정됨 · ${clip(t.title)}`,
          desc: `${me.name}님이 지정${t.dueDate ? ` · 마감 ${t.dueDate}` : ""}`,
          href: "/tasks",
          icon: "SquareCheck",
        },
      ];
    }

    case "comment_added": {
      const [parent, pid, cid] = id.split(":");
      if (!(parent in PARENTS) || !pid || !cid) throw new Forbidden();
      const p = PARENTS[parent as keyof typeof PARENTS];
      const c = await getDocData<{ uid: string; body: string }>(db, `${parent}/${pid}/comments/${cid}`);
      if (c.uid !== uid) throw new Forbidden();

      let title: string;
      let allowMentions: boolean = p.mentions;
      let related: (string | undefined | null)[];
      if (parent === "tasks") {
        const t = await getDocData<TaskDoc>(db, `tasks/${pid}`);
        title = t.title;
        related = [t.createdBy, t.assigneeId];
      } else if (parent === "notices") {
        const n = await getDocData<NoticeDoc>(db, `notices/${pid}`);
        title = n.title;
        related = [n.authorUid];
        // 임시저장 공지는 작성자·관리자만 볼 수 있어 멘션으로 알리지 않습니다
        if (n.status === "draft") allowMentions = false;
      } else {
        const a = await getDocData<ApprovalDoc>(db, `approvals/${pid}`);
        title = a.title || pid;
        related = [a.authorUid, ...(a.approverUids ?? [])];
      }

      const base = {
        key: `c_${parent}_${pid}_${cid}`,
        toggle: "inboxMention" as const,
        cat: p.cat,
        desc: `${me.name}: ${clip(c.body)}`,
        href: p.href(pid),
        icon: "MessageSquare",
      };
      const items = new Map<string, Item>();
      if (allowMentions) {
        const names = mentionedNames(c.body);
        if (names.length) {
          const snap = await db.collection("users").where("name", "in", names).get();
          for (const d of snap.docs) {
            items.set(d.id, { ...base, to: d.id, title: `${me.name}님이 회원님을 언급했습니다 · ${clip(title, 40)}` });
          }
        }
      }
      for (const to of related) {
        if (to && !items.has(to)) items.set(to, { ...base, to, title: `새 댓글 · ${clip(title, 50)}` });
      }
      return [...items.values()];
    }
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

  let body: { event?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }
  const event = body.event as InboxEvent;
  const id = body.id;
  if (!EVENTS.includes(event)) return fail("unsupported_event", 400);
  if (typeof id !== "string" || !/^[\w.:-]{1,200}$/.test(id)) return fail("invalid_body", 400);

  const db = admin.db;
  // firestore.rules 의 isMember() 와 같은 기준 (2FA 통과 포함)
  const me = await getUser(db, uid);
  if (me?.status !== "ACTIVE") return fail("forbidden", 403);
  if (me.twoFactorId && tokenTwoFactorId !== me.twoFactorId) return fail("forbidden", 403);

  let items: Item[];
  try {
    items = await buildItems(db, event, id, uid, me);
  } catch (e) {
    if (e instanceof Forbidden) return fail("forbidden", 403);
    return fail("internal", 500);
  }

  let delivered = 0;
  for (const it of items) {
    if (it.to === uid) continue; // 내가 한 일은 나에게 알리지 않습니다
    const to = await getUser(db, it.to);
    if (to?.status !== "ACTIVE" || to.gwSettings?.toggles?.[it.toggle] === false) continue;
    try {
      await db.doc(`users/${it.to}/inbox/${it.key}`).create({
        cat: it.cat,
        title: it.title,
        desc: it.desc,
        href: it.href,
        icon: it.icon,
        actorUid: uid,
        at: FieldValue.serverTimestamp(),
        readAt: null,
      });
      delivered += 1;
    } catch {
      /* 이미 보낸 알림(같은 key) — 무시 */
    }
  }
  return NextResponse.json({ ok: true, delivered });
}
