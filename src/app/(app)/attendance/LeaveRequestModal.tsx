"use client";

import * as React from "react";
import { Palmtree, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Submit = {
  kind: string;
  start: string;
  end: string;
  days: number;
  hours?: number;
  reason: string;
};

const LEAVE_KINDS = ["연차", "반차", "경조", "병가"];
const input =
  "h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

export function LeaveRequestModal({
  mode,
  remaining,
  onClose,
  onSubmit,
}: {
  mode: "leave" | "overtime";
  remaining: number;
  onClose: () => void;
  onSubmit: (input: Submit) => Promise<void>;
}) {
  const overtime = mode === "overtime";
  const [kind, setKind] = React.useState(overtime ? "초과근무" : "연차");
  const [start, setStart] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [end, setEnd] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [hours, setHours] = React.useState("2");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const spanDays =
    Math.max(
      1,
      Math.round(
        (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000,
      ) + 1,
    );
  const days = overtime ? 0 : kind === "반차" ? 0.5 : spanDays;
  const overBalance = !overtime && kind !== "반차" && days > remaining;
  const valid =
    reason.trim().length > 0 &&
    !overBalance &&
    (!overtime || Number(hours) > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    await onSubmit({
      kind,
      start,
      end: overtime ? start : end,
      days,
      hours: overtime ? Number(hours) : 0,
      reason: reason.trim(),
    });
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#eef2ff] text-primary">
            {overtime ? (
              <Timer className="size-4" />
            ) : (
              <Palmtree className="size-4" />
            )}
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.015em]">
              {overtime ? "초과근무 신청" : "연차 / 반차 신청"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {overtime
                ? "승인되면 주 52시간 트래커에 반영됩니다"
                : `승인 대기로 등록됩니다 · 잔여 연차 ${remaining}일`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4"
        >
          {!overtime && (
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                휴가 종류
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LEAVE_KINDS.map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                      kind === k
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-secondary-foreground hover:bg-secondary",
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <div className="flex-[1_1_150px]">
              <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                {overtime ? "근무일" : "시작일"}
              </div>
              <input
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (e.target.value > end) setEnd(e.target.value);
                }}
                className={input}
              />
            </div>
            {overtime ? (
              <div className="flex-[1_1_150px]">
                <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                  초과 시간 (h)
                </div>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className={input}
                />
              </div>
            ) : (
              <div className="flex-[1_1_150px]">
                <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                  종료일
                </div>
                <input
                  type="date"
                  value={end}
                  min={start}
                  disabled={kind === "반차"}
                  onChange={(e) => setEnd(e.target.value)}
                  className={cn(input, "disabled:opacity-50")}
                />
              </div>
            )}
          </div>

          {!overtime && (
            <div className="flex items-baseline gap-1.5 rounded-[9px] border border-[#e0e7ff] bg-[#f5f6ff] px-3 py-2">
              <span className="text-[13px] font-semibold tabular-nums text-[#3730a3]">
                {days}일
              </span>
              <span className="text-[11.5px] text-[#6366f1]">
                신청 후 잔여 {Math.max(0, remaining - days)}일
              </span>
              {overBalance && (
                <span className="ml-auto text-[11.5px] font-semibold text-[#b91c1c]">
                  잔여 연차 부족
                </span>
              )}
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
              사유
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={
                overtime
                  ? "예: 배포 대응으로 야간 근무"
                  : "예: 개인 사유 (가족 행사)"
              }
              className={cn(input, "h-auto resize-none py-2")}
            />
          </div>
        </form>

        <div className="flex gap-2 border-t border-[#eef1f5] bg-secondary px-5 py-3.5">
          <button
            onClick={onClose}
            className="h-10 flex-1 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-[#f1f5f9]"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={!valid || saving}
            className={cn(
              "h-10 flex-[2] rounded-[10px] text-[13px] font-semibold transition-colors",
              !valid || saving
                ? "cursor-not-allowed bg-[#f1f5f9] text-muted-foreground"
                : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
            )}
          >
            {saving ? "신청 중…" : "신청하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
