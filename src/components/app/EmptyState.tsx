import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Action = {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
};

function ActionButton({
  action,
  variant,
}: {
  action: Action;
  variant: "primary" | "ghost" | "outline";
}) {
  const cls = cn(
    "flex h-[38px] items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold transition-colors",
    variant === "primary" &&
      "bg-primary pr-4 text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover active:translate-y-px",
    variant === "outline" &&
      "border border-border bg-card text-secondary-foreground hover:border-ring hover:bg-secondary",
    variant === "ghost" &&
      "h-8 border border-border bg-card px-3.5 text-[12.5px] text-primary hover:border-[#c7d2fe] hover:bg-[#f5f6ff]",
  );
  if (action.href) {
    return (
      <Link href={action.href} className={cls}>
        {action.icon}
        {action.label}
      </Link>
    );
  }
  return (
    <button onClick={action.onClick} className={cls}>
      {action.icon}
      {action.label}
    </button>
  );
}

export function EmptyState({
  icon,
  tint = ["#eef2ff", "#4f46e5"],
  title,
  desc,
  cta,
  alt,
  header,
  count = 0,
  className,
}: {
  icon: React.ReactNode;
  /** [배경, 아이콘 색] */
  tint?: [string, string];
  title: string;
  desc?: string;
  cta?: Action;
  alt?: Action;
  /** 카드 상단 헤더(아이콘 + 라벨 + 건수). 생략하면 헤더 없이 렌더 */
  header?: { icon?: React.ReactNode; label: string };
  count?: number;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {header && (
        <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-4.5 py-3.5">
          {header.icon && (
            <span className="flex text-muted-foreground">{header.icon}</span>
          )}
          <span className="text-[13px] font-semibold tracking-[-0.01em]">
            {header.label}
          </span>
          <span className="ml-auto text-[11.5px] text-[#cbd5e1]">
            {count}건
          </span>
        </div>
      )}
      <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
        <div
          className="flex size-[62px] items-center justify-center rounded-[18px]"
          style={{ background: tint[0], color: tint[1] }}
        >
          {icon}
        </div>
        <div className="mt-3 text-[15px] font-semibold tracking-[-0.02em]">
          {title}
        </div>
        {desc && (
          <p className="max-w-[340px] text-pretty text-[12.5px] leading-[1.7] text-muted-foreground">
            {desc}
          </p>
        )}
        {(cta || alt) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {cta && <ActionButton action={cta} variant="primary" />}
            {alt && <ActionButton action={alt} variant="outline" />}
          </div>
        )}
      </div>
    </section>
  );
}

export function EmptyStateCompact({
  icon,
  tint = ["#f1f5f9", "#64748b"],
  title,
  desc,
  cta,
  className,
}: {
  icon: React.ReactNode;
  tint?: [string, string];
  title: string;
  desc?: string;
  cta?: Action;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-[13px] border border-border bg-card px-4.5 py-6 text-center shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div
        className="flex size-[46px] items-center justify-center rounded-[14px]"
        style={{ background: tint[0], color: tint[1] }}
      >
        {icon}
      </div>
      <div className="mt-2 text-[13px] font-semibold">{title}</div>
      {desc && (
        <p className="text-[11.5px] leading-[1.6] text-muted-foreground">{desc}</p>
      )}
      {cta && (
        <div className="mt-2.5">
          <ActionButton action={cta} variant="ghost" />
        </div>
      )}
    </div>
  );
}
