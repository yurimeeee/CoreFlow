"use client";

import * as React from "react";
import { Loader2, RotateCcw, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/groupware/data";
import { offboardApi, offboardErrorMessage, type HandoverCounts } from "@/lib/offboardApi";
import { GwCard } from "@/components/app/primitives";

/**
 * 퇴사 처리 — 후임자를 고르면 서버가 넘길 결재·Task·직속 구성원 건수를
 * 미리 계산해 보여주고, 확인하면 계정 차단과 인계를 함께 처리합니다.
 */
export function OffboardModal({
  person: p,
  directory,
  onClose,
  onDone,
}: {
  person: Person;
  directory: Person[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [successorUid, setSuccessorUid] = React.useState("");
  const [preview, setPreview] = React.useState<HandoverCounts | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const candidates = directory.filter((x) => x.id !== p.id && !x.placeholder);

  // 넘기지 못하는 결재(후임자가 기안자)는 후임자에 따라 달라져 고를 때마다 다시 계산
  React.useEffect(() => {
    let alive = true;
    offboardApi("preview", p.id, successorUid || null).then((r) => {
      if (!alive) return;
      if (r.ok && r.counts) {
        setPreview(r.counts);
        setPreviewError(null);
      } else {
        setPreviewError(offboardErrorMessage(r.error));
      }
    });
    return () => {
      alive = false;
    };
  }, [p.id, successorUid]);

  const total = preview ? preview.approvals + preview.tasks + preview.reports : 0;
  const needsSuccessor = total > 0 && !successorUid;
  const canSubmit = !!preview && !needsSuccessor && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const r = await offboardApi("offboard", p.id, successorUid || null);
    setBusy(false);
    if (!r.ok) {
      setError(offboardErrorMessage(r.error));
      return;
    }
    toast.success(`${p.name} 님을 퇴사 처리했습니다.`);
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f172a]/45 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#fef2f2] text-[#b91c1c]">
            <UserMinus className="size-4" />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.015em]">{p.name} 님 퇴사 처리</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              로그인이 즉시 막히고, 맡던 일은 후임자에게 넘어갑니다
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
          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
              후임자{total > 0 && <span className="ml-0.5 text-[#e11d48]">*</span>}
            </div>
            <select
              value={successorUid}
              onChange={(e) => setSuccessorUid(e.target.value)}
              className="h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              <option value="">{total > 0 ? "후임자를 선택하세요" : "지정 안 함"}</option>
              {candidates.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.role} ({x.dept})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[10px] border border-border bg-secondary px-3.5 py-3 text-[12.5px]">
            {previewError ? (
              <p className="font-medium text-destructive">{previewError}</p>
            ) : !preview ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                넘길 일을 확인하는 중…
              </span>
            ) : total === 0 && preview.skippedApprovals.length === 0 ? (
              <p className="text-muted-foreground">넘길 결재·Task·직속 구성원이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-secondary-foreground">
                <li>진행 중 결재의 결재 차례 {preview.approvals}건</li>
                <li>미완료 Task {preview.tasks}건</li>
                <li>직속 구성원 {preview.reports}명의 상사 변경</li>
                {preview.skippedApprovals.length > 0 && (
                  <li className="font-medium text-[#b45309]">
                    후임자가 기안한 결재 {preview.skippedApprovals.length}건(
                    {preview.skippedApprovals.join(", ")})은 본인이 결재할 수 없어 넘기지 않습니다. 다른
                    결재자를 지정해 다시 상신하게 해 주세요.
                  </li>
                )}
              </ul>
            )}
          </div>

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
            disabled={!canSubmit}
            className={cn(
              "h-10 flex-[2] rounded-[10px] text-[13px] font-semibold transition-colors",
              canSubmit
                ? "bg-[#dc2626] text-white hover:bg-[#b91c1c]"
                : "cursor-not-allowed bg-[#f1f5f9] text-muted-foreground",
            )}
          >
            {busy ? "처리하는 중…" : "퇴사 처리"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 퇴사자 목록 — 관리자 전용, 복직 처리 */
export function FormerPeopleCard({ people }: { people: Person[] }) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  if (people.length === 0) return null;

  const reinstate = async (p: Person) => {
    if (busyId || !window.confirm(`${p.name} 님을 복직 처리할까요? 로그인이 다시 가능해집니다.`)) return;
    setBusyId(p.id);
    const r = await offboardApi("reinstate", p.id);
    setBusyId(null);
    if (r.ok) toast.success(`${p.name} 님을 복직 처리했습니다.`);
    else toast.error(offboardErrorMessage(r.error));
  };

  return (
    <GwCard className="p-3">
      <div className="px-1 pb-2 text-[12px] font-semibold text-muted-foreground">퇴사자 {people.length}명</div>
      <ul className="flex flex-col">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium">{p.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {p.role} · {p.dept}
              </div>
            </div>
            <button
              onClick={() => reinstate(p)}
              disabled={busyId !== null}
              title="복직"
              className="flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11.5px] font-semibold text-secondary-foreground hover:bg-secondary disabled:opacity-50"
            >
              <RotateCcw className="size-3" />
              복직
            </button>
          </li>
        ))}
      </ul>
    </GwCard>
  );
}
