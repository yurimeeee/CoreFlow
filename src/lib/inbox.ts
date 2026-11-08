/**
 * 알림 센터 받은편지함 — 쓰기(결재·Task·댓글 등)가 끝난 "뒤에" 어떤 일이
 * 일어났는지만 서버(/api/notifications)에 알리면, 서버가 문서를 확인해
 * 받는 사람의 users/{uid}/inbox 에 알림을 남깁니다.
 *
 * notifyEvent(웹훅)와 마찬가지로 best-effort — 실패해도 호출한 쪽을 막지
 * 않도록 예외를 삼킵니다.
 */
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import type { InboxEvent } from "@/app/api/notifications/route";

export async function pushInbox(event: InboxEvent, id: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    const token = await firebaseAuth().currentUser?.getIdToken();
    if (!token) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event, id }),
    });
  } catch {
    /* 알림은 부가 기능 — 무시 */
  }
}
