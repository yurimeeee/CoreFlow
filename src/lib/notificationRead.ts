/**
 * 헤더 알림벨의 "읽음" 상태 영속화.
 *
 * 알림은 전용 컬렉션 없이 결재·공지·근태에서 파생되는 값이라(useNotifications
 * 참고) 서버에 읽음 여부를 쓸 문서가 없습니다 — 대신 계정별로 localStorage에
 * 읽은 알림 id 목록만 저장해, 새로고침/다른 탭에서도 유지되게 합니다.
 */

const KEY_PREFIX = "cf_notif_read:";

export function getReadIds(uid: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + uid);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function saveReadIds(uid: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + uid, JSON.stringify(ids));
  } catch {
    /* 저장소를 쓸 수 없는 환경(프라이빗 모드 등)이면 조용히 무시 */
  }
}
