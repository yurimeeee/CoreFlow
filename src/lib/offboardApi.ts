/**
 * /api/admin/offboard 클라이언트 — 퇴사 처리는 Auth 계정 차단이 필요해
 * 서버가 맡습니다(라우트 주석 참고).
 */
import { firebaseAuth } from "@/lib/firebase";

export interface HandoverCounts {
  approvals: number;
  tasks: number;
  reports: number;
  /** 후임자가 기안자라 넘기지 못한 결재 문서 번호 */
  skippedApprovals: string[];
}

export interface OffboardResponse {
  ok: boolean;
  error?: string;
  counts?: HandoverCounts;
}

export async function offboardApi(
  action: "preview" | "offboard" | "reinstate",
  uid: string,
  successorUid?: string | null,
): Promise<OffboardResponse> {
  const user = firebaseAuth().currentUser;
  if (!user) return { ok: false, error: "unauthenticated" };
  try {
    const res = await fetch("/api/admin/offboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ action, uid, successorUid: successorUid ?? null }),
    });
    return ((await res.json().catch(() => null)) as OffboardResponse | null) ?? {
      ok: false,
      error: "internal",
    };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

const MESSAGES: Record<string, string> = {
  not_configured: "서버에 Firebase 서비스 계정이 설정되지 않아 처리할 수 없습니다.",
  unauthenticated: "로그인 세션이 만료됐습니다. 다시 로그인해 주세요.",
  forbidden: "이 작업을 할 권한이 없습니다. 최고 관리자는 최고 관리자만 퇴사 처리할 수 있습니다.",
  not_found: "구성원을 찾을 수 없습니다.",
  self: "본인은 퇴사 처리할 수 없습니다.",
  not_account: "가계정·초대 중인 계정은 퇴사 처리 대신 삭제해 주세요.",
  not_resigned: "퇴사 처리된 계정이 아닙니다.",
  successor_required: "넘겨야 할 결재·Task·직속 구성원이 있어 후임자를 지정해야 합니다.",
  successor_invalid: "후임자는 재직 중인 다른 구성원이어야 합니다.",
  auth_disable_failed: "퇴사 상태로 바꿨지만 로그인 차단에 실패했습니다. 다시 시도해 주세요.",
  handover_incomplete: "퇴사 처리와 로그인 차단은 끝났지만 일부 인계가 실패했습니다. 다시 시도하면 남은 인계를 이어서 합니다.",
  network_error: "네트워크 오류로 처리하지 못했습니다.",
};

export function offboardErrorMessage(error?: string) {
  return (error && MESSAGES[error]) || "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
