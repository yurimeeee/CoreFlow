/**
 * 2FA 세션 검증 플래그.
 *
 * Firebase Auth 세션 자체는 브라우저(로컬 저장소)에 남아있으므로, "이번
 * 브라우저 세션에서 TOTP/백업 코드까지 확인했는지"는 별도로 sessionStorage
 * 에 기록합니다 (탭/브라우저를 닫으면 초기화 → 다음 접속 때 다시 요구).
 *
 * 주의: 클라이언트 저장소 기반 체크라 devtools 조작으로 우회될 수 있습니다.
 * 서버(Cloud Functions/커스텀 클레임) 없이 완결되는 데모용 2FA의 한계입니다.
 */

const KEY_PREFIX = "cf_2fa_verified:";

export function isTwoFactorVerified(uid: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY_PREFIX + uid) === "1";
  } catch {
    return false;
  }
}

export function markTwoFactorVerified(uid: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY_PREFIX + uid, "1");
  } catch {
    /* 저장소를 쓸 수 없는 환경(프라이빗 모드 등)이면 조용히 무시 */
  }
}

export function clearTwoFactorVerified(uid: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY_PREFIX + uid);
  } catch {
    /* noop */
  }
}
