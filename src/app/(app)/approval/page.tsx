"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleX,
  Inbox,
  Loader,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APPROVAL_ROWS,
  APPROVAL_STATS,
  APPROVAL_STATUS_COLORS,
  APPROVAL_TABS,
  APPROVAL_TYPE_COLORS,
} from "@/lib/groupware/data";
import { pill } from "@/lib/groupware/ui";
import { GwCard, PageHeader, StatCard } from "@/components/app/primitives";

const STAT_ICONS: Record<string, React.ElementType> = {
  Inbox,
  Loader,
  CircleCheck,
  CircleX,
};

export default function ApprovalPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState(0);
  const rows = APPROVAL_ROWS[tab];

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
              value={st.value}
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
          <div className="ml-auto flex h-8.5 items-center gap-1.5 rounded-[9px] border border-border bg-secondary px-2.5">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <span className="text-[12.5px] text-muted-foreground">전체 기간</span>
          </div>
        </div>

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
      </GwCard>
    </div>
  );
}
