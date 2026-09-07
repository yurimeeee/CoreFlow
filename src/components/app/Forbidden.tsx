"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Send,
  ShieldAlert,
  ShieldOff,
  User,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pill } from "@/lib/groupware/ui";

export type PermRow = {
  icon?: React.ReactNode;
  tint: [string, string];
  label: string;
  value: string;
  state: string;
  statePill: [string, string];
};

const DEFAULT_ROWS: PermRow[] = [
  {
    icon: <User className="size-[15px]" />,
    tint: ["#f1f5f9", "#64748b"],
    label: "내 역할",
    value: "Member",
    state: "현재",
    statePill: ["#f1f5f9", "#475569"],
  },
  {
    icon: <ShieldAlert className="size-[15px]" />,
    tint: ["#fef2f2", "#dc2626"],
    label: "필요 권한",
    value: "Manager 이상 · 부서 문서 열람",
    state: "미충족",
    statePill: ["#fef2f2", "#b91c1c"],
  },
  {
    icon: <UserCheck className="size-[15px]" />,
    tint: ["#eef2ff", "#4f46e5"],
    label: "문서 소유자",
    value: "기안자에게 참조 요청",
    state: "승인 필요",
    statePill: ["#eef2ff", "#4338ca"],
  },
];

export function Forbidden({
  title = "이 문서는 결재선에 없습니다",
  desc = "접근 권한이 없습니다. 열람이 필요하면 문서 기안자에게 참조자 추가를 요청하거나, 관리자에게 권한 상향을 신청하세요.",
  rows = DEFAULT_ROWS,
  requestLabel = "열람 권한 요청하기",
  className,
}: {
  title?: string;
  desc?: string;
  rows?: PermRow[];
  requestLabel?: string;
  className?: string;
}) {
  const [requested, setRequested] = React.useState(false);

  return (
    <div
      className={cn(
        "flex min-h-dvh items-center justify-center bg-background px-6 py-12",
        className,
      )}
    >
      <div className="animate-step flex w-full max-w-[600px] flex-col items-center text-center">
        <div className="relative flex items-center justify-center">
          <div className="text-[116px] font-extrabold leading-none tracking-[-0.06em] text-[#fee2e2]">
            403
          </div>
          <div className="absolute flex size-[62px] items-center justify-center rounded-[18px] border border-[#fecaca] bg-card shadow-[0_10px_26px_rgba(190,18,60,0.12)]">
            <ShieldOff className="size-[26px] text-[#dc2626]" />
          </div>
        </div>

        <h1 className="mt-6 text-[23px] font-bold tracking-[-0.03em]">{title}</h1>
        <p className="mt-2.5 max-w-[420px] text-pretty text-[13px] leading-[1.75] text-muted-foreground">
          {desc}
        </p>

        <div className="mt-6 w-full rounded-[13px] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-col">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center gap-2.5 border-t border-[#f1f5f9] py-2.5 text-left first:border-t-0"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-[9px]"
                  style={{ background: r.tint[0], color: r.tint[1] }}
                >
                  {r.icon ?? <ShieldAlert className="size-[15px]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-secondary-foreground">
                    {r.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                    {r.value}
                  </span>
                </span>
                <span style={pill(r.statePill[0], r.statePill[1])}>
                  {r.state}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setRequested(true)}
            disabled={requested}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-[10px] pl-3 pr-4 text-[13px] font-semibold transition-colors",
              requested
                ? "cursor-default bg-[#f0fdf4] text-[#15803d]"
                : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
            )}
          >
            <Send className="size-4" />
            {requested ? "열람 요청을 보냈습니다" : requestLabel}
          </button>
          <Link
            href="/dashboard"
            className="flex h-10 items-center gap-1.5 rounded-[10px] border border-border bg-card pl-3 pr-4 text-[13px] font-semibold text-secondary-foreground transition-colors hover:border-ring hover:bg-secondary"
          >
            <LayoutDashboard className="size-4" />
            대시보드로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
