import { NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/firebaseAdmin";

/**
 * Slack / Jandi Incoming Webhook 릴레이.
 *
 * 두 서비스 모두 브라우저에서 직접 fetch 하면 CORS 로 막히기 때문에, 이
 * 서버 라우트가 대신 POST 합니다.
 *
 * 웹훅 URL은 클라이언트가 보내지 않습니다 — 관리자만 읽을 수 있는
 * integrationSecrets/main 에서 서버가 직접 읽습니다. 예전엔 URL이 구성원
 * 누구나 읽는 workspace/main 에 있어서, 아무 직원이나(퇴사 후에도, URL이
 * 바뀌기 전까지) 회사 Slack 채널에 공지를 사칭한 메시지를 보낼 수
 * 있었습니다. 이제 호출자는 Firebase ID 토큰으로 ACTIVE 구성원임을 증명해야
 * 하고, 임의 URL로 보내는 "테스트 전송"은 관리자만 가능합니다.
 */

const ALLOWED_HOSTS: Record<string, string[]> = {
  slack: ["hooks.slack.com"],
  jandi: ["wh.jandi.com"],
};

const MAX_LEN = 4000;

interface NotifyBody {
  service?: string;
  text?: string;
  title?: string;
  /** 설정 화면의 테스트 전송 — 관리자만, 저장 전 URL로 바로 보내봅니다. */
  testWebhookUrl?: string;
}

type Service = "slack" | "jandi";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  const admin = firebaseAdmin();
  if (!admin) return fail("not_configured", 503);

  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fail("unauthenticated", 401);
  let uid: string;
  try {
    uid = (await admin.auth.verifyIdToken(token)).uid;
  } catch {
    return fail("unauthenticated", 401);
  }

  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }

  const { service, text, title, testWebhookUrl } = body;
  if (service !== "slack" && service !== "jandi") return fail("unsupported_service", 400);
  if (!text || text.length > MAX_LEN) return fail("invalid_body", 400);

  // firestore.rules 의 isMember()/isAdmin() 과 같은 기준
  const me = (await admin.db.doc(`users/${uid}`).get()).data();
  if (me?.status !== "ACTIVE") return fail("forbidden", 403);
  const isAdmin = me.role === "ADMIN" || me.role === "SUPER_ADMIN";

  let webhookUrl: string | undefined;
  if (testWebhookUrl !== undefined) {
    if (!isAdmin) return fail("forbidden", 403);
    webhookUrl = testWebhookUrl;
  } else {
    const ws = (await admin.db.doc("workspace/main").get()).data();
    if (!ws?.integrations?.[service as Service]?.on) {
      return NextResponse.json({ ok: false, error: "disabled" });
    }
    const secrets = (await admin.db.doc("integrationSecrets/main").get()).data();
    webhookUrl = secrets?.[service as Service]?.webhookUrl;
    if (!webhookUrl) return NextResponse.json({ ok: false, error: "disabled" });
  }

  let url: URL;
  try {
    url = new URL(webhookUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_url" }, { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS[service].includes(url.hostname)) {
    return NextResponse.json({ ok: false, error: "host_not_allowed" }, { status: 400 });
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
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: "upstream_error", status: upstream.status, detail },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "network_error" }, { status: 502 });
  }
}
