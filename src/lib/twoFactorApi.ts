/**
 * /api/auth/two-factor 클라이언트 — 2FA 비밀키는 서버만 다루므로 브라우저는
 * 코드를 보내고, 통과하면 받은 커스텀 토큰으로 다시 로그인합니다. 그 세션의
 * ID 토큰에 twoFactorId 클레임이 붙어야 보안 규칙(isMember)이 데이터를 열어
 * 줍니다.
 */
import { signInWithCustomToken } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { markTwoFactorVerified } from "@/lib/twoFactorSession";

export type TwoFactorAction =
  | "status"
  | "verify"
  | "enrollStart"
  | "enrollConfirm"
  | "enrollActivate"
  | "disable"
  | "regenerateBackupCodes";

export interface TwoFactorResponse {
  ok: boolean;
  error?: string;
  retryAfterSec?: number;
  enabled?: boolean;
  satisfied?: boolean;
  backupCount?: number;
  secret?: string;
  token?: string;
  twoFactorId?: string;
  backupCodes?: string[];
}

export async function twoFactorApi(
  action: TwoFactorAction,
  code?: string,
): Promise<TwoFactorResponse> {
  const user = firebaseAuth().currentUser;
  if (!user) return { ok: false, error: "unauthenticated" };
  try {
    const res = await fetch("/api/auth/two-factor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ action, code }),
    });
    return ((await res.json().catch(() => null)) as TwoFactorResponse | null) ?? {
      ok: false,
      error: "internal",
    };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

/** 서버가 발급한 커스텀 토큰으로 같은 계정에 다시 로그인하고 이번 세션을 통과로 기록 */
export async function adoptTwoFactorToken(token: string, twoFactorId: string): Promise<void> {
  const cred = await signInWithCustomToken(firebaseAuth(), token);
  markTwoFactorVerified(cred.user.uid, twoFactorId);
}

/** 사용자에게 보여 줄 오류 문구 */
export function twoFactorErrorMessage(r: TwoFactorResponse, fallback: string): string {
  switch (r.error) {
    case "invalid_code":
      return "코드가 올바르지 않습니다. 앱의 코드를 다시 확인해 주세요.";
    case "locked":
      return `실패가 많아 잠시 잠겼습니다. ${Math.ceil((r.retryAfterSec ?? 300) / 60)}분 뒤 다시 시도해 주세요.`;
    case "enroll_expired":
      return "등록 시간이 지났습니다. 창을 닫고 다시 시작해 주세요.";
    case "not_configured":
      return "서버에 Firebase 서비스 계정이 설정되지 않아 2단계 인증을 사용할 수 없습니다.";
    case "network_error":
      return "네트워크 오류입니다. 잠시 후 다시 시도해 주세요.";
    default:
      return fallback;
  }
}
