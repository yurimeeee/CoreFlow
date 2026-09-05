import * as React from "react";
import { cn } from "@/lib/utils";
import { avatarStyle, pill } from "@/lib/groupware/ui";
import { TAG_COLORS } from "@/lib/groupware/data";

export function GwCard({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-[-0.025em]">{title}</h1>
        {desc && (
          <p className="mt-1 text-[12.5px] text-muted-foreground">{desc}</p>
        )}
      </div>
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({
  name,
  size = 34,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span style={avatarStyle(name.charAt(0), size)} className={className}>
      {name.charAt(0)}
    </span>
  );
}

export function Tag({ label }: { label: string }) {
  const c = TAG_COLORS[label] ?? ["#f1f5f9", "#475569"];
  return <span style={pill(c[0], c[1])}>{label}</span>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[9px] bg-[#f1f5f9] p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-[30px] items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] tracking-[-0.01em] transition-all",
            value === o.value
              ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.1)]"
              : "font-medium text-muted-foreground hover:text-secondary-foreground",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  on,
  onClick,
  size = "md",
  className,
}: {
  on: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const w = size === "sm" ? "w-9" : "w-[42px]";
  const h = size === "sm" ? "h-5" : "h-6";
  const knob = size === "sm" ? "size-[14px]" : "size-[18px]";
  const onLeft = size === "sm" ? "left-[19px]" : "left-[21px]";
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative shrink-0 rounded-full transition-colors",
        w,
        h,
        on ? "bg-primary" : "bg-[#cbd5e1]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] rounded-full bg-white shadow transition-[left]",
          knob,
          on ? onLeft : "left-[3px]",
        )}
      />
    </button>
  );
}

export function StatCard({
  label,
  value,
  unit = "건",
  icon,
  iconBg,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:border-[#cbd5e1]">
      {icon && (
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: iconBg }}
        >
          {icon}
        </span>
      )}
      <div>
        <div className="text-[12px] text-muted-foreground">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span
            className="text-2xl font-bold tracking-[-0.03em] tabular-nums"
            style={{ color: valueColor }}
          >
            {value}
          </span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}
