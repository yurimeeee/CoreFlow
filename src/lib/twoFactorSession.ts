/**
 * 2FA 세션 검증 플래그.
 *
 * Firebase Auth 세션 자체는 브라우저(로컬 저장소)에 남아있으므로, "이번
 * 브라우저 세션에서 TOTP/백업 코드까지 확인했는지"는 별도로 sessionStorage
 * 에 기록합니다 (탭/브라우저를 닫으면 초기화 → 다음 접속 때 다시 요구).
 *
 * 값은 확인한 등록의 id(users/{uid}.twoFactorId)입니다 — 화면이 서버 왕복
 * 없이 "현재 등록을 이 세션에서 확인했는지"를 바로 판단하는 용도일 뿐이고,
 * 실제 차단은 보안 규칙이 ID 토큰의 twoFactorId 클레임으로 합니다. 그래서
 * devtools 로 이 값을 조작해도 데이터는 열리지 않습니다.
 */

const KEY_PREFIX = "cf_2fa_verified:";

/** 이번 브라우저 세션에서 확인한 2FA 등록 id (없으면 null) */
export function verifiedTwoFactorId(uid: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(KEY_PREFIX + uid);
  } catch {
    return null;
  }
}

export function markTwoFactorVerified(uid: string, twoFactorId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY_PREFIX + uid, twoFactorId);
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
