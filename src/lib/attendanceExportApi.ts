/**
 * /api/admin/attendance-export 클라이언트 — 받은 CSV 를 파일로 저장합니다.
 * 내보내기는 서버가 감사 로그를 남긴 뒤에만 내려줍니다(라우트 주석 참고).
 */
import { firebaseAuth } from "@/lib/firebase";
import type { ExportKind } from "@/lib/attendanceExport";

const ERRORS: Record<string, string> = {
  unauthenticated: "다시 로그인해주세요.",
  forbidden: "관리자만 내보낼 수 있습니다.",
  invalid_range: "기간을 확인해주세요. 최대 366일까지 내보낼 수 있습니다.",
  invalid_team: "부서를 찾을 수 없습니다.",
  not_configured: "서버에 Firebase 서비스 계정이 설정되지 않았습니다.",
};

export async function downloadAttendanceCsv(input: {
  start: string;
  end: string;
  teamId: string | null;
  kind: ExportKind;
}): Promise<void> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error(ERRORS.unauthenticated);
  const res = await fetch("/api/admin/attendance-export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify({ ...input, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(ERRORS[j?.error ?? ""] ?? "내보내지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `근태_${input.kind === "daily" ? "일별" : "요약"}_${input.start}_${input.end}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
