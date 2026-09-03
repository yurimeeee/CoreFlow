import * as React from "react";
import Link from "next/link";
import { CalendarClock, FileCheck2, Network, Waypoints } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const HIGHLIGHTS = [
  { icon: CalendarClock, label: "출퇴근 기록", desc: "근태를 자동으로 집계" },
  { icon: FileCheck2, label: "전자결재", desc: "서명·직인까지 한 흐름으로" },
  { icon: Network, label: "조직도", desc: "담당 업무 기반 협업" },
];

interface AuthShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row">
      {/* 브랜드 패널 */}
      <aside className="relative hidden overflow-hidden bg-[#1e293b] px-12 py-14 text-white lg:flex lg:w-[42%] lg:flex-col lg:justify-between xl:w-[38%]">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full bg-[#6366f1]/20 blur-3xl"
          aria-hidden
        />

        <Link href="/" className="relative">
          <Logo tone="invert" />
        </Link>

        <div className="relative space-y-6">
          <Waypoints className="size-10 text-primary" strokeWidth={1.6} />
          <h2 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em]">
            모든 업무의 중심을 잇다
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-slate-300">
            출퇴근 기록부터 전자결재, 프로젝트 관리, 조직도까지 — 파편화된 기업의
            핵심 업무(Core)를 끊김 없는 하나의 흐름(Flow)으로 연결합니다.
          </p>

          <ul className="space-y-3 pt-2">
            {HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-white/10">
                  <Icon className="size-4 text-slate-100" />
                </span>
                <span className="text-sm">
                  <b className="font-semibold">{label}</b>
                  <span className="ml-2 text-slate-400">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} CoreFlow. All rights reserved.
        </p>
      </aside>

      {/* 콘텐츠 */}
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-xl">
          <div className="mb-8 lg:hidden">
            <Link href="/">
              <Logo />
            </Link>
          </div>

          <div className="mb-7">
            {eyebrow && (
              <p className="mb-2 text-[13px] font-semibold text-primary">
                {eyebrow}
              </p>
            )}
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-[28px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          {children}

          {footer && (
            <div className="mt-6 text-center text-[13px] text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
