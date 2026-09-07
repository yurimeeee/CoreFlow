"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleX,
  FilePlus2,
  Inbox,
  Loader,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APPROVAL_STATS,
  APPROVAL_STATUS_COLORS,
  APPROVAL_TABS,
  APPROVAL_TYPE_COLORS,
} from "@/lib/groupware/data";
import { pill } from "@/lib/groupware/ui";
import { useApprovals } from "@/lib/groupware/hooks";
import { useNow } from "@/lib/groupware/use-now";
import { GwCard, PageHeader, StatCard } from "@/components/app/primitives";
import { EmptyState } from "@/components/app/EmptyState";

const STAT_ICONS: Record<string, React.ElementType> = {
  Inbox,
  Loader,
  CircleCheck,
  CircleX,
};

const BUCKETS = ["pending", "drafted", "referenced"] as const;

const PERIODS = [
  { label: "전체 기간", days: 0 },
  { label: "최근 7일", days: 7 },
  { label: "최근 30일", days: 30 },
];

/** "MM.DD" → 기준 시각(now) 대비 ms. 미래 날짜는 작년으로 보정 */
function parseDocDate(mmdd: string, now: Date): number {
  const [m, d] = mmdd.split(".").map(Number);
  if (!m || !d) return 0;
  let dt = new Date(now.getFullYear(), m - 1, d);
  if (dt.getTime() > now.getTime()) dt = new Date(now.getFullYear() - 1, m - 1, d);
  return dt.getTime();
}

export default function ApprovalPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState(0);
  const [periodIdx, setPeriodIdx] = React.useState(0);
  const { data } = useApprovals();
  const now = useNow();

  const counts = React.useMemo(() => {
    const by = (s: string) => data.filter((r) => r.status === s).length;
    return {
      "결재 대기": by("Waiting"),
      "진행 중": by("In Progress"),
      완료: by("Approved"),
      반려: by("Rejected"),
    } as Record<string, number>;
  }, [data]);

  const period = PERIODS[periodIdx];
  const cutoff =
    period.days > 0 && now ? now.getTime() - period.days * 86_400_000 : 0;
  const rows = data
    .filter((r) => r.bucket === BUCKETS[tab])
    .filter((r) => !cutoff || (now ? parseDocDate(r.date, now) : 0) >= cutoff)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-4.5">
      <PageHeader
        title="전자결재"
        desc="내가 결재할 문서와 상신한 문서를 한곳에서 관리합니다"
        actions={
          <button
            onClick={() => router.push("/approval/new")}
            className="flex h-9.5 items-center gap-1.5 rounded-[9px] bg-primary pl-3 pr-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
          >
            <Plus className="size-4" strokeWidth={2.2} />새 결재 기안하기
          </button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        {APPROVAL_STATS.map((st) => {
          const Icon = STAT_ICONS[st.icon];
          return (
            <StatCard
              key={st.label}
              label={st.label}
              value={counts[st.label] ?? 0}
              valueColor={st.color}
              iconBg={st.bg}
              icon={<Icon className="size-[17px]" style={{ color: st.color }} />}
            />
          );
        })}
      </div>

      <GwCard>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#eef1f5] px-4 py-3">
          <div className="flex gap-1">
            {APPROVAL_TABS.map((label, i) => (
              <button
                key={label}
                onClick={() => setTab(i)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  i === tab
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex h-8.5 items-center gap-1.5 rounded-[9px] border border-border bg-secondary pl-2.5 pr-1.5">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <select
              value={periodIdx}
              onChange={(e) => setPeriodIdx(Number(e.target.value))}
              className="bg-transparent text-[12.5px] text-muted-foreground focus-visible:outline-none"
            >
              {PERIODS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            className="rounded-none border-0 shadow-none"
            icon={<Inbox className="size-[26px]" />}
            title={
              periodIdx > 0
                ? "해당 기간에 문서가 없습니다"
                : ["결재할 문서가 없습니다", "상신한 문서가 없습니다", "참조 문서가 없습니다"][tab]
            }
            desc={
              periodIdx > 0
                ? "기간 필터를 넓혀 보세요."
                : [
                    "현재 내 차례로 넘어온 문서가 없습니다. 새 문서를 기안해 보세요.",
                    "임시저장 중이거나 상신한 문서가 여기에 표시됩니다.",
                    "내가 참조자로 지정된 문서가 여기에 표시됩니다.",
                  ][tab]
            }
            cta={
              tab === 0 || tab === 1
                ? {
                    label: "새 결재 기안하기",
                    icon: <FilePlus2 className="size-4" />,
                    onClick: () => router.push("/approval/new"),
                  }
                : undefined
            }
          />
        ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[880px] border-b border-[#eef1f5] bg-secondary px-4.5 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
            <div className="w-[116px] shrink-0">문서번호</div>
            <div className="min-w-[200px] flex-1">문서 제목</div>
            <div className="w-[100px] shrink-0">기안자</div>
            <div className="w-[84px] shrink-0">기안일</div>
            <div className="w-[104px] shrink-0">최종 결재자</div>
            <div className="w-[110px] shrink-0 text-right">진행 상태</div>
          </div>
          {rows.map((r) => {
            const tp = APPROVAL_TYPE_COLORS[r.type] ?? ["#f1f5f9", "#475569"];
            const st = APPROVAL_STATUS_COLORS[r.status];
            return (
              <button
                key={r.no}
                onClick={() => router.push(`/approval/${r.no}`)}
                className="flex min-w-[880px] items-center border-b border-[#f1f5f9] px-4.5 py-3 text-left text-[12.5px] transition-colors hover:bg-secondary"
              >
                <div className="w-[116px] shrink-0 font-mono text-[11.5px] text-muted-foreground">
                  {r.no}
                </div>
                <div className="flex min-w-[200px] flex-1 items-center gap-2 pr-3.5">
                  <span style={pill(tp[0], tp[1])}>{r.type}</span>
                  <span className="flex-1 truncate font-medium text-foreground">
                    {r.title}
                  </span>
                </div>
                <div className="w-[100px] shrink-0 truncate text-secondary-foreground">
                  {r.author}
                </div>
                <div className="w-[84px] shrink-0 tabular-nums text-muted-foreground">
                  {r.date}
                </div>
                <div className="w-[104px] shrink-0 truncate text-secondary-foreground">
                  {r.approver}
                </div>
                <div className="flex w-[110px] shrink-0 justify-end">
                  <span style={pill(st[0], st[1])}>{r.status}</span>
                </div>
              </button>
            );
          })}
        </div>
        )}
      </GwCard>
    </div>
  );
}
