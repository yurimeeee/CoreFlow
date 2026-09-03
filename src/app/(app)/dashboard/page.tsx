"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileCheck2,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  SquareKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DASH_APPROVALS,
  DASH_NOTICES,
  DASH_SCHEDULE,
  DASH_TASKS,
} from "@/lib/groupware/data";
import { ddayStyle, pill } from "@/lib/groupware/ui";
import { useNow } from "@/lib/groupware/use-now";
import { GwCard, Tag } from "@/components/app/primitives";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const two = (n: number) => String(n).padStart(2, "0");
const WORKED = 32;
const LIMIT = 52;

export default function DashboardPage() {
  const now = useNow();
  const [working, setWorking] = React.useState(true);
  const [inAt, setInAt] = React.useState("09:02");
  const [outAt, setOutAt] = React.useState("--:--");
  const [tasks, setTasks] = React.useState(DASH_TASKS);
  const [rollIdx, setRollIdx] = React.useState(0);

  React.useEffect(() => {
    const r = setInterval(() => setRollIdx((i) => (i + 1) % 3), 4200);
    return () => clearInterval(r);
  }, []);

  const pct = Math.min(100, Math.round((WORKED / LIMIT) * 1000) / 10);
  const dateLabel = now
    ? `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`
    : "";
  const clock = now ? `${two(now.getHours())}:${two(now.getMinutes())}` : "--:--";
  const seconds = now ? `:${two(now.getSeconds())}` : ":--";
  const rolling = DASH_NOTICES[rollIdx];
  const doneCount = tasks.filter((t) => t.done).length;

  const checkIn = () => {
    const d = new Date();
    setWorking(true);
    setInAt(`${two(d.getHours())}:${two(d.getMinutes())}`);
    setOutAt("--:--");
  };
  const checkOut = () => {
    const d = new Date();
    setWorking(false);
    setOutAt(`${two(d.getHours())}:${two(d.getMinutes())}`);
  };

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-4.5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12.5px] text-muted-foreground">{dateLabel}</div>
          <div className="mt-1 text-[22px] font-bold tracking-[-0.025em]">
            안녕하세요, 김세진 과장님
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-[12.5px] text-secondary-foreground">
          <span className="size-[7px] animate-pulse rounded-full bg-success" />
          본사 · 재직 중 · {working ? "근무 중" : "퇴근 완료"}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-4.5">
        {/* 출퇴근 */}
        <GwCard className="flex min-w-[300px] flex-[1_1_320px] flex-col gap-4 p-4.5">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">
              출퇴근 기록
            </h3>
            <span className="ml-auto text-[11.5px] text-muted-foreground">
              {working ? "근무 중" : "출근 전"}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-[40px] font-semibold leading-none tracking-[-0.045em] tabular-nums">
              {clock}
            </div>
            <div className="text-sm text-muted-foreground tabular-nums">
              {seconds}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={checkIn}
              disabled={working}
              className={cn(
                "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold transition-all",
                working
                  ? "cursor-not-allowed border border-border bg-secondary text-[#cbd5e1]"
                  : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
              )}
            >
              <LogIn className="size-4" />
              출근 기록
            </button>
            <button
              onClick={checkOut}
              disabled={!working}
              className={cn(
                "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold transition-all",
                !working
                  ? "cursor-not-allowed border border-border bg-secondary text-[#cbd5e1]"
                  : "border border-border bg-card text-secondary-foreground hover:bg-secondary",
              )}
            >
              <LogOut className="size-4" />
              퇴근 기록
            </button>
          </div>
          <div className="flex gap-2.5 text-xs">
            {[
              ["출근", inAt],
              ["퇴근", outAt],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex-1 rounded-[9px] border border-border bg-secondary px-2.5 py-2"
              >
                <div className="text-[11px] text-muted-foreground">{k}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">
                  {v}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">
                이번 주 누적 근무
              </span>
              <span className="text-[12.5px] font-semibold tabular-nums">
                {WORKED}시간 / {LIMIT}시간
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#eef1f5]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>주 {LIMIT}시간 기준</span>
              <span>잔여 {LIMIT - WORKED}시간</span>
            </div>
          </div>
        </GwCard>

        {/* 전자결재 */}
        <GwCard className="flex min-w-[300px] flex-[1_1_320px] flex-col gap-3.5 p-4.5">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">
              전자결재
            </h3>
            <Link
              href="/approval"
              className="ml-auto flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-semibold text-primary hover:bg-accent"
            >
              전체 <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="flex gap-2">
            {[
              ["대기", 3, "#f5f6ff", "#e0e7ff", "#3730a3"],
              ["진행", 1, "#f8fafc", "#eef1f5", "#0f172a"],
              ["승인", 12, "#f8fafc", "#eef1f5", "#0f172a"],
            ].map(([label, n, bg, bd, fg]) => (
              <Link
                href="/approval"
                key={label as string}
                className="flex-1 rounded-[11px] border p-3 transition-transform hover:-translate-y-px"
                style={{ background: bg as string, borderColor: bd as string }}
              >
                <div className="text-[11.5px] font-semibold text-muted-foreground">
                  {label}
                </div>
                <div className="mt-0.5 flex items-baseline gap-0.5">
                  <span
                    className="text-2xl font-bold tracking-[-0.03em] tabular-nums"
                    style={{ color: fg as string }}
                  >
                    {n}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">건</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-0.5 flex flex-col gap-0.5">
            <div className="px-2 pb-0.5 text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
              최근 문서
            </div>
            {DASH_APPROVALS.map((d) => (
              <Link
                href="/approval"
                key={d.title}
                className="flex items-center gap-2.5 rounded-[9px] px-2 py-2 transition-colors hover:bg-secondary"
              >
                <span style={pill("#eef2ff", "#4338ca")}>{d.type}</span>
                <span className="flex-1 truncate text-[12.5px]">{d.title}</span>
                <span
                  style={pill(
                    d.state === "Waiting" ? "#fff7ed" : "#eef2ff",
                    d.state === "Waiting" ? "#c2410c" : "#4338ca",
                  )}
                >
                  {d.state}
                </span>
              </Link>
            ))}
          </div>
        </GwCard>

        {/* 공지사항 */}
        <GwCard className="flex min-w-[300px] flex-[1_1_320px] flex-col gap-3.5 p-4.5">
          <div className="flex items-center gap-2">
            <Megaphone className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">
              공지사항
            </h3>
            <span className="ml-auto text-[11.5px] font-semibold text-primary">
              필독 2건
            </span>
          </div>
          <div className="flex min-h-[78px] flex-col justify-center gap-1.5 rounded-[11px] border border-[#e0e7ff] bg-gradient-to-br from-[#f5f6ff] to-white px-3.5 py-3">
            <div className="flex items-center gap-1.5">
              <span
                className="rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-bold text-white"
                style={{ background: "#4f46e5" }}
              >
                필독
              </span>
              <span className="text-[11.5px] text-[#6366f1]">
                {rolling.dept} · {rolling.date}
              </span>
            </div>
            <div className="text-[13.5px] font-semibold leading-snug tracking-[-0.015em] text-[#1e1b4b]">
              {rolling.title}
            </div>
          </div>
          <div className="flex flex-col">
            {DASH_NOTICES.map((n) => (
              <Link
                href="/notice"
                key={n.title}
                className="flex items-center gap-2.5 border-b border-[#f1f5f9] py-2.5 transition-[padding] hover:pl-2"
              >
                <span
                  className="size-[5px] shrink-0 rounded-full"
                  style={{ background: n.must ? "#4f46e5" : "#cbd5e1" }}
                />
                {n.must && (
                  <span
                    className="whitespace-nowrap rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold text-primary"
                    style={{ background: "#eef2ff" }}
                  >
                    필독
                  </span>
                )}
                <span
                  className={cn(
                    "flex-1 truncate text-[12.5px]",
                    n.must
                      ? "font-semibold text-secondary-foreground"
                      : "text-secondary-foreground",
                  )}
                >
                  {n.title}
                </span>
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  {n.date}
                </span>
              </Link>
            ))}
          </div>
        </GwCard>
      </div>

      <div className="flex flex-wrap items-stretch gap-4.5">
        {/* 오늘의 Task */}
        <GwCard className="flex min-w-[320px] flex-[2_1_560px] flex-col gap-3.5 p-4.5">
          <div className="flex items-center gap-2">
            <SquareKanban className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">
              오늘의 Task
            </h3>
            <span className="text-[11.5px] text-muted-foreground">
              {doneCount} / {tasks.length} 완료
            </span>
            <Link
              href="/tasks"
              className="ml-auto flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-semibold text-primary hover:bg-accent"
            >
              보드 열기 <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="flex flex-col">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  setTasks((prev) =>
                    prev.map((x) =>
                      x.id === t.id ? { ...x, done: !x.done } : x,
                    ),
                  )
                }
                className="flex items-center gap-2.5 border-b border-[#f1f5f9] px-2 py-2.5 text-left transition-[padding,background] hover:bg-secondary hover:pl-3"
              >
                <span
                  className={cn(
                    "flex size-[17px] shrink-0 items-center justify-center rounded-[5px] transition-colors",
                    t.done
                      ? "bg-primary text-white"
                      : "border-[1.5px] border-[#cbd5e1] bg-card",
                  )}
                >
                  {t.done && <Check className="size-[11px]" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "flex-1 truncate text-[13px] tracking-[-0.01em]",
                    t.done
                      ? "text-muted-foreground line-through"
                      : "font-medium text-foreground",
                  )}
                >
                  {t.title}
                </span>
                <Tag label={t.tag} />
                <span className="flex items-center gap-1 whitespace-nowrap text-[11.5px] text-muted-foreground">
                  <CalendarDays className="size-3" />
                  {t.due}
                </span>
                <span style={ddayStyle(t.dday)}>{t.dday}</span>
              </button>
            ))}
          </div>
        </GwCard>

        {/* 오늘의 일정 */}
        <GwCard className="flex min-w-[280px] flex-[1_1_300px] flex-col gap-3 p-4.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">
              오늘의 일정
            </h3>
            <span className="ml-auto text-[11.5px] text-muted-foreground">
              {DASH_SCHEDULE.length}건
            </span>
          </div>
          {DASH_SCHEDULE.map((s) => (
            <div
              key={s.title}
              className="flex gap-2.5 rounded-[9px] px-1.5 py-2 transition-colors hover:bg-secondary"
            >
              <div className="w-12 shrink-0 pt-px text-xs tabular-nums text-muted-foreground">
                {s.time}
              </div>
              <div
                className="w-0.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold tracking-[-0.01em]">
                  {s.title}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <MapPin className="size-3" />
                  {s.place}
                </div>
              </div>
            </div>
          ))}
        </GwCard>
      </div>
    </div>
  );
}
