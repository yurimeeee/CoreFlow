/**
 * Slack / Jandi 알림 발송 — 워크스페이스 설정(`workspace/main.integrations`)을
 * 읽어 꺼져 있거나 웹훅 URL이 없으면 조용히 무시하고, 켜져 있으면
 * `/api/integrations/notify` 서버 라우트를 통해 실제로 전송합니다.
 *
 * 항상 best-effort — 실패해도 호출한 쪽의 Firestore 쓰기(공지/결재/휴가
 * 신청 등)를 막지 않도록 모든 함수가 예외를 삼킵니다.
 */
import { doc, getDoc } from "firebase/firestore";
import { firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import type { WorkspaceDoc, WorkspaceWebhookIntegration } from "@/lib/groupware/firestore";

async function getIntegration(
  key: "slack" | "jandi",
): Promise<WorkspaceWebhookIntegration | null> {
  if (!isFirebaseConfigured) return null;
  try {
    const snap = await getDoc(doc(firebaseDb(), "workspace", "main"));
    if (!snap.exists()) return null;
    return ((snap.data() as WorkspaceDoc).integrations?.[key]) ?? null;
  } catch {
    return null;
  }
}

async function relay(
  service: "slack" | "jandi",
  webhookUrl: string,
  text: string,
  title?: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/integrations/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service, webhookUrl, text, title }),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return !!data?.ok;
  } catch {
    return false;
  }
}

/** 결재/공지 알림 — Slack 채널로 전송 (연동이 꺼져 있으면 무시) */
export async function notifySlack(text: string, title?: string): Promise<void> {
  const cfg = await getIntegration("slack");
  if (!cfg?.on || !cfg.webhookUrl) return;
  await relay("slack", cfg.webhookUrl, text, title);
}

/** 근태(연차·초과근무) 알림 — Jandi 토픽으로 전송 (연동이 꺼져 있으면 무시) */
export async function notifyJandi(text: string, title?: string): Promise<void> {
  const cfg = await getIntegration("jandi");
  if (!cfg?.on || !cfg.webhookUrl) return;
  await relay("jandi", cfg.webhookUrl, text, title);
}

/** 설정 화면의 "테스트 메시지 보내기" — 저장 여부와 무관하게 즉시 전송해봅니다. */
export async function sendTestNotification(
  service: "slack" | "jandi",
  webhookUrl: string,
): Promise<boolean> {
  return relay(
    service,
    webhookUrl,
    "CoreFlow 연동 테스트 메시지입니다. 이 메시지가 보이면 연동이 정상 동작합니다. ✅",
    "CoreFlow 연동 테스트",
  );
}
