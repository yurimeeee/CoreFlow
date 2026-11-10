"use client";

import * as React from "react";
import { Loader2, UserCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn, localDateStr } from "@/lib/utils";
import { delegationError, MAX_DELEGATION_DAYS, type DelegationDoc } from "@/lib/delegation";
import { useCurrentUser, useOrgPeople, type useMyDelegation } from "@/lib/groupware/hooks";
import { useNow } from "@/lib/groupware/use-now";

type MyDelegation = ReturnType<typeof useMyDelegation>;

const two = (n: number) => String(n).padStart(2, "0");
const mmdd = (d: Date) => `${two(d.getMonth() + 1)}.${two(d.getDate())}`;

/** until 은 마지막 날 "다음 날 00:00" 이라 하루 빼서 끝 날로 보여줍니다 */
function lastDay(d: Pick<DelegationDoc, "until">) {
  const u = d.until.toDate();
  return new Date(u.getFullYear(), u.getMonth(), u.getDate() - 1);
}

function periodLabel(d: Pick<DelegationDoc, "from" | "until">) {
  return `${mmdd(d.from.toDate())} ~ ${mmdd(lastDay(d))}`;
}

/**
 * 전자결재 화면 상단 안내 — 내가 걸어 둔 위임(진행 중·예정)과, 지금 내가
 * 대신 처리하고 있는 사람들의 결재를 보여줍니다.
 */
export function DelegationBanner({
  my: { delegation, clear },
  actingFor,
  onEdit,
}: {
  my: MyDelegation;
  actingFor: string[];
  onEdit: () => void;
}) {
  const { nameOf } = useOrgPeople();
  const now = useNow();
  const [clearing, setClearing] = React.useState(false);

  const mine = delegation && now && delegation.until.toMillis() > now.getTime() ? delegation : null;
  if (!mine && actingFor.length === 0) return null;

  const release = async () => {
    if (!window.confirm("결재 위임을 해제할까요? 지금부터 다시 본인이 결재합니다.")) return;
    setClearing(true);
    try {
      await clear();
      toast.success("결재 위임을 해제했습니다.");
    } catch {
      toast.error("위임을 해제하지 못했습니다.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {mine && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[11px] border border-[#c7d2fe] bg-[#eef2ff] px-3.5 py-2.5 text-[12.5px] text-[#3730a3]">
          <Users className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <b>{nameOf(mine.delegateUid)}</b>님에게 결재를 위임
            {mine.from.toMillis() > (now?.getTime() ?? 0) ? "할 예정입니다" : "했습니다"} · {periodLabel(mine)}
            {mine.reason && <span className="text-[#6366f1]"> ({mine.reason})</span>}
          </span>
          <button onClick={onEdit} className="rounded-md px-2 py-1 font-semibold hover:bg-[#e0e7ff]">
            변경
          </button>
          <button
            onClick={release}
            disabled={clearing}
            className="rounded-md px-2 py-1 font-semibold hover:bg-[#e0e7ff] disabled:opacity-50"
          >
            {clearing ? "해제하는 중…" : "해제"}
          </button>
        </div>
      )}
      {actingFor.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-[11px] border border-[#fed7aa] bg-[#fff7ed] px-3.5 py-2.5 text-[12.5px] text-[#9a3412]">
          <UserCheck className="size-4 shrink-0" />
          <span>
            <b>{actingFor.map(nameOf).join(", ")}</b>님의 결재를 대신 처리하고 있습니다. 결재 대기함에
            &lsquo;대리&rsquo;로 표시됩니다.
          </span>
        </div>
      )}
    </div>
  );
}

/** 결재 위임 설정 — 받을 사람·기간·사유. 저장하면 이전 위임을 덮어씁니다. */
export function DelegationModal({
  my: { delegation, save },
  onClose,
}: {
  my: MyDelegation;
  onClose: () => void;
}) {
  const me = useCurrentUser();
  const { people } = useOrgPeople();
  // 아직 끝나지 않은 위임이 있으면 그 값으로 채워 "변경"합니다
  const [init] = React.useState(() => {
    const today = localDateStr();
    const live = delegation && delegation.until.toMillis() > Date.now() ? delegation : null;
    return {
      today,
      delegateUid: live?.delegateUid ?? "",
      start: live ? localDateStr(live.from.toDate()) : today,
      end: live ? localDateStr(lastDay(live)) : today,
      reason: live?.reason ?? "",
    };
  });
  const today = init.today;
  const [delegateUid, setDelegateUid] = React.useState(init.delegateUid);
  const [start, setStart] = React.useState(init.start);
  const [end, setEnd] = React.useState(init.end);
  const [reason, setReason] = React.useState(init.reason);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const candidates = people.filter((p) => p.id !== me.uid && !p.placeholder);
  const canSubmit = !!delegateUid && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    const invalid = delegationError(start, end, new Date());
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save({ delegateUid, start, end, reason: reason.slice(0, 200) });
      toast.success("결재를 위임했습니다.");
      onClose();
    } catch {
      setError("위임하지 못했습니다. 받을 사람이 재직 중인지 확인해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

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
            <Users className="size-4" />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.015em]">결재 위임</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              자리를 비우는 동안 내 결재 차례를 다른 사람이 대신 처리합니다
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
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              받을 사람<span className="ml-0.5 text-[#e11d48]">*</span>
            </span>
            <select value={delegateUid} onChange={(e) => setDelegateUid(e.target.value)} className={field}>
              <option value="">선택하세요</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.role} ({p.dept})
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-muted-foreground">시작일</span>
              <input type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} className={field} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-muted-foreground">종료일</span>
              <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={field} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-foreground">사유</span>
            <input
              value={reason}
              maxLength={200}
              placeholder="예: 연차, 해외 출장"
              onChange={(e) => setReason(e.target.value)}
              className={field}
            />
          </label>
          <ul className="list-disc rounded-[10px] border border-border bg-secondary py-2.5 pl-7 pr-3.5 text-[12px] leading-[1.6] text-secondary-foreground">
            <li>기간 중에 내 차례가 된 문서를 받을 사람이 열람하고 승인·반려할 수 있습니다.</li>
            <li>결재란에는 내 이름과 함께 &lsquo;대리&rsquo; 처리자가 기록됩니다.</li>
            <li>받을 사람이 기안한 문서는 대신 결재할 수 없습니다. 최대 {MAX_DELEGATION_DAYS}일.</li>
          </ul>
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
              "flex h-10 flex-[2] items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold transition-colors",
              canSubmit
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "cursor-not-allowed bg-[#f1f5f9] text-muted-foreground",
            )}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? "저장하는 중…" : "위임하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
