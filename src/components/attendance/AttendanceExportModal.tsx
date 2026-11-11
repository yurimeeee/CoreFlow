"use client";

import * as React from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn, localDateStr } from "@/lib/utils";
import type { ExportKind } from "@/lib/attendanceExport";
import { downloadAttendanceCsv } from "@/lib/attendanceExportApi";
import { useTeams } from "@/lib/groupware/hooks";

const KINDS: { key: ExportKind; label: string; desc: string }[] = [
  { key: "daily", label: "일별 기록", desc: "날짜별 출퇴근 시각·근무시간·휴가" },
  { key: "summary", label: "인원별 요약", desc: "근무일수·총 근무시간·지각·휴가일수" },
];

/** 이번 달 1일 ~ 오늘, 지난 달 1일 ~ 말일 */
function presets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    thisMonth: { start: localDateStr(new Date(y, m, 1)), end: localDateStr(now) },
    lastMonth: { start: localDateStr(new Date(y, m - 1, 1)), end: localDateStr(new Date(y, m, 0)) },
  };
}

/** 근태 CSV 내보내기 — 관리자 전용. 내보낸 기록은 감사 로그에 남습니다. */
export function AttendanceExportModal({ onClose }: { onClose: () => void }) {
  const { teams } = useTeams();
  const [p] = React.useState(presets);
  const [start, setStart] = React.useState(p.thisMonth.start);
  const [end, setEnd] = React.useState(p.thisMonth.end);
  const [teamId, setTeamId] = React.useState("");
  const [kind, setKind] = React.useState<ExportKind>("daily");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 본부 아래에 팀을 들여 보여줍니다
  const options = teams
    .filter((t) => !t.parentId)
    .flatMap((top) => [
      { id: top.id, label: top.name },
      ...teams.filter((t) => t.parentId === top.id).map((t) => ({ id: t.id, label: `　${t.name}` })),
    ]);

  const submit = async () => {
    if (busy) return;
    if (!start || !end || start > end) {
      setError("기간을 확인해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await downloadAttendanceCsv({ start, end, teamId: teamId || null, kind });
      toast.success("근태 기록을 내보냈습니다.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "내보내지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";
  const chip =
    "rounded-md border border-border bg-card px-2 py-1 text-[11.5px] font-semibold text-secondary-foreground hover:bg-secondary";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f172a]/45 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#eef2ff] text-primary">
            <Download className="size-4" />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.015em]">근태 내보내기</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              출퇴근·승인된 휴가 기록을 CSV(엑셀)로 받습니다
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="flex-1 text-[11.5px] font-semibold text-muted-foreground">기간</span>
              <button
                className={chip}
                onClick={() => {
                  setStart(p.thisMonth.start);
                  setEnd(p.thisMonth.end);
                }}
              >
                이번 달
              </button>
              <button
                className={chip}
                onClick={() => {
                  setStart(p.lastMonth.start);
                  setEnd(p.lastMonth.end);
                }}
              >
                지난 달
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
              <span className="text-muted-foreground">~</span>
              <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={field} />
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-foreground">부서</span>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={field}>
              <option value="">전체</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-foreground">형식</span>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={cn(
                    "rounded-[10px] border px-3 py-2.5 text-left transition-colors",
                    kind === k.key ? "border-primary bg-accent" : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  <div className="text-[13px] font-semibold">{k.label}</div>
                  <div className="mt-0.5 text-[11px] leading-[1.45] text-muted-foreground">{k.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <p className="rounded-[10px] border border-border bg-secondary px-3.5 py-2.5 text-[12px] leading-[1.6] text-secondary-foreground">
            개인 근태 정보가 담긴 파일입니다. 내보낸 사람·기간·대상은 감사 로그에 기록됩니다.
          </p>
          {error && (
            <p role="alert" className="text-[12.5px] font-semibold text-[#b91c1c]">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-[#eef1f5] bg-secondary px-5 py-3.5">
          <button
            onClick={onClose}
            className="h-10 flex-1 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-[#f1f5f9]"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex h-10 flex-[2] items-center justify-center gap-1.5 rounded-[10px] bg-primary text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {busy ? "내보내는 중…" : "CSV 내려받기"}
          </button>
        </div>
      </div>
    </div>
  );
}
