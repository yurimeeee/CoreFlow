import { NextResponse } from "next/server";

/**
 * Slack / Jandi Incoming Webhook 릴레이.
 *
 * 두 서비스 모두 브라우저에서 직접 fetch 하면 CORS 로 막히기 때문에, 이
 * 서버 라우트가 대신 POST 합니다. 웹훅 호스트를 허용목록으로 제한해
 * 임의 URL로 요청을 전달하는 오픈 릴레이가 되지 않도록 막습니다.
 *
 * 참고: 이 라우트는 Firebase 세션을 서버에서 검증하지 않습니다(이 프로젝트
 * 전체가 Firestore 보안 규칙에 의존하는 클라이언트 중심 구조라 별도
 * firebase-admin 없이는 서버 검증이 불가). 호스트 제한 덕분에 호출자가
 * 할 수 있는 최악의 일은 "자신이 이미 알고 있는" Slack/Jandi 웹훅으로
 * 메시지를 보내는 것뿐입니다.
 */

const ALLOWED_HOSTS: Record<string, string[]> = {
  slack: ["hooks.slack.com"],
  jandi: ["wh.jandi.com"],
};

const MAX_LEN = 4000;

interface NotifyBody {
  service?: string;
  webhookUrl?: string;
  text?: string;
  title?: string;
}

export async function POST(req: Request) {
  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { service, webhookUrl, text, title } = body;
  if (service !== "slack" && service !== "jandi") {
    return NextResponse.json(
      { ok: false, error: "unsupported_service" },
      { status: 400 },
    );
  }
  if (!webhookUrl || !text || text.length > MAX_LEN) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
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
