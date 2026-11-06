/**
 * Slack / Jandi 알림 발송 — 워크스페이스 설정(`workspace/main.integrations`)을
 * 읽어 꺼져 있으면 조용히 무시하고, 켜져 있으면 `/api/integrations/notify`
 * 서버 라우트를 통해 실제로 전송합니다. 웹훅 URL은 관리자 전용 문서
 * (integrationSecrets/main)에 있어 클라이언트는 모르고, 서버 라우트가
 * 로그인 토큰을 검증한 뒤 직접 읽습니다.
 *
 * 문구도 클라이언트가 만들지 않습니다 — 어떤 일이 일어났는지(event)와 문서
 * id 만 보내면 서버가 문서를 읽어 호출자가 실제로 그 일을 했는지 확인하고
 * 문구를 만듭니다. 그래서 쓰기(setDoc/updateDoc)가 끝난 "뒤에" 호출해야
 * 합니다.
 *
 * 항상 best-effort — 실패해도 호출한 쪽의 Firestore 쓰기(공지/결재/휴가
 * 신청 등)를 막지 않도록 모든 함수가 예외를 삼킵니다.
 */
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { firebaseAuth, firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import type { WorkspaceDoc, WorkspaceWebhookIntegration } from "@/lib/groupware/firestore";
import type { NotifyEvent } from "@/app/api/integrations/notify/route";

// notifyEvent는 공지·결재·근태 등 거의 모든 쓰기 경로에서
// 호출되는데, workspace/main 은 관리자가 가끔 연동 설정을 바꿀 때만
// 변하는 문서입니다. 호출마다 getDoc 을 새로 하는 대신 한 번만
// onSnapshot 을 구독해 두고 캐시된 값을 재사용합니다.
let cachedWorkspace: WorkspaceDoc | null | undefined; // undefined = 아직 로드 전
let subscribed = false;

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  onSnapshot(
    doc(firebaseDb(), "workspace", "main"),
    (snap) => {
      cachedWorkspace = snap.exists() ? (snap.data() as WorkspaceDoc) : null;
    },
    () => {
      cachedWorkspace = null;
    },
  );
}

async function getIntegration(
  key: "slack" | "jandi",
): Promise<WorkspaceWebhookIntegration | null> {
  if (!isFirebaseConfigured) return null;
  ensureSubscribed();
  if (cachedWorkspace === undefined) {
    // 구독의 첫 스냅샷이 아직 도착 전이면(콜드 스타트) 한 번만 직접 읽습니다.
    try {
      const snap = await getDoc(doc(firebaseDb(), "workspace", "main"));
      cachedWorkspace = snap.exists() ? (snap.data() as WorkspaceDoc) : null;
    } catch {
      return null;
    }
  }
  return cachedWorkspace?.integrations?.[key] ?? null;
}

async function relay(body: Record<string, unknown>): Promise<boolean> {
  try {
    const token = await firebaseAuth().currentUser?.getIdToken();
    if (!token) return false;
    const res = await fetch("/api/integrations/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return !!data?.ok;
  } catch {
    return false;
  }
}

/** 공지·결재는 Slack, 근태(연차·초과근무)는 Jandi 로 갑니다 (서버와 같은 매핑) */
const SERVICE_OF: Record<NotifyEvent, "slack" | "jandi"> = {
  notice_published: "slack",
  approval_submitted: "slack",
  approval_decided: "slack",
  leave_requested: "jandi",
  leave_decided: "jandi",
};

/** 이벤트 알림 — 해당 연동이 꺼져 있으면 서버를 부르지 않고 무시 */
export async function notifyEvent(event: NotifyEvent, id: string): Promise<void> {
  const cfg = await getIntegration(SERVICE_OF[event]);
  if (!cfg?.on) return;
  await relay({ event, id });
}

/** 설정 화면의 "테스트 메시지 보내기" — 관리자 전용, 입력한 URL로 즉시 전송해봅니다. */
export async function sendTestNotification(
  service: "slack" | "jandi",
  webhookUrl: string,
): Promise<boolean> {
  return relay({ test: { service, webhookUrl } });
}
