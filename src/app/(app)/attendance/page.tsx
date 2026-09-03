"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  LogIn,
  LogOut,
  Palmtree,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATT_DAY_DATA,
  ATT_TYPE_COLORS,
  LEAVE_HISTORY,
} from "@/lib/groupware/data";
import { pill } from "@/lib/groupware/ui";
import { useNow } from "@/lib/groupware/use-now";
import { useAttendance } from "@/lib/groupware/hooks";
import { GwCard, PageHeader, Segmented } from "@/components/app/primitives";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const two = (n: number) => String(n).padStart(2, "0");
const LIMIT = 52;

const LEGEND = [
  { label: "정상근무", c: "#4f46e5" },
  { label: "지각", c: "#f59e0b" },
  { label: "연장근무", c: "#e11d48" },
  { label: "재택", c: "#16a34a" },
  { label: "연차", c: "#94a3b8" },
];

export default function AttendancePage() {
  const now = useNow();
  const { working, inAt, outAt, weekWorked, history, checkIn, checkOut } =
    useAttendance();
  const [view, setView] = React.useState<"calendar" | "list">("calendar");

  const clock = now ? `${two(now.getHours())}:${two(now.getMinutes())}` : "--:--";
  const seconds = now ? `:${two(now.getSeconds())}` : ":--";
  const pct = Math.min(100, Math.round((weekWorked / LIMIT) * 1000) / 10);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < 2; i++) {
    cells.push(
      <div key={`e${i}`} className="min-h-[84px] rounded-[10px] bg-[#fbfcfe]" />,
    );
  }
  for (let d = 1; d <= 30; d++) {
    const rec = ATT_DAY_DATA[d];
    const weekend = (d + 1) % 7 === 0 || (d + 2) % 7 === 0;
    const today = d === 2;
    const tc = rec ? ATT_TYPE_COLORS[rec[2]] : null;
    cells.push(
      <div
        key={d}
        className="flex min-h-[84px] flex-col rounded-[10px] border px-2.5 py-2"
        style={{
          borderColor: today ? "#4f46e5" : "#eef1f5",
          background: today ? "#f5f6ff" : weekend ? "#fbfcfe" : "#fff",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-semibold tabular-nums"
            style={{
              color: today ? "#4f46e5" : weekend ? "#94a3b8" : "#334155",
            }}
          >
            {d}
          </span>
          {rec && tc && <span style={pill(tc[0], tc[1])}>{rec[2]}</span>}
        </div>
        {rec && rec[0] !== "—" && (
          <div className="mt-auto text-[10.5px] leading-normal tabular-nums text-secondary-foreground">
            <div>{rec[0]}</div>
            <div className="text-muted-foreground">{rec[1]}</div>
          </div>
        )}
      </div>,
    );
  }

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-4.5">
      <PageHeader
        title="출퇴근 / 근태 관리"
        desc="2026년 9월 · 유연근무제(선택근무) · 플랫폼개발팀"
        actions={
          <>
            <button className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-semibold text-secondary-foreground hover:bg-secondary">
              <Palmtree className="size-4 text-primary" />
              연차 / 반차 신청
            </button>
            <button className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover">
              <Timer className="size-4" />
              초과근무 신청
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-stretch gap-4.5">
        <GwCard className="flex min-w-[320px] flex-[1_1_380px] flex-col gap-4.5 p-5.5">
          <div className="flex items-baseline gap-2.5">
            <div className="text-[56px] font-medium leading-none tracking-[-0.05em] tabular-nums">
              {clock}
            </div>
            <div className="text-xl text-muted-foreground tabular-nums">
              {seconds}
            </div>
            <div className="ml-auto text-right">
              <div className="text-[11.5px] text-muted-foreground">
                {now
                  ? `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`
                  : ""}
              </div>
              <div className="mt-0.5 text-[12.5px] font-semibold text-success">
                {working ? "근무 중" : "퇴근 완료"}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => checkIn()}
              disabled={working}
              className={cn(
                "flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold transition-all",
                working
                  ? "cursor-not-allowed border border-border bg-secondary text-[#cbd5e1]"
                  : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
              )}
            >
              <LogIn className="size-4" />
              출근하기
            </button>
            <button
              onClick={() => checkOut()}
              disabled={!working}
              className={cn(
                "flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold transition-all",
                !working
                  ? "cursor-not-allowed border border-border bg-secondary text-[#cbd5e1]"
                  : "border border-border bg-card text-secondary-foreground hover:bg-secondary",
              )}
            >
              <LogOut className="size-4" />
              퇴근하기
            </button>
          </div>

          <div className="flex gap-2.5 text-xs">
            {[
              ["오늘 출근", inAt],
              ["오늘 퇴근", outAt],
              ["오늘 근무", "7.4h"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex-1 rounded-[10px] border border-border bg-secondary px-3 py-2.5"
              >
                <div className="text-[11px] text-muted-foreground">{k}</div>
                <div className="mt-0.5 text-[15px] font-semibold tabular-nums">
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12.5px] text-muted-foreground">
                이번 주 누적 근무
              </span>
              <span style={pill("#f0fdf4", "#15803d")}>
                소정근로 내 · 연장 여유 12시간
              </span>
              <span className="ml-auto text-[13px] font-semibold tabular-nums">
                {weekWorked}시간 / {LIMIT}시간
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#eef1f5]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11.5px] text-muted-foreground">
              <span>법정 한도 주 {LIMIT}시간 (소정 40h + 연장 12h)</span>
              <span>잔여 {LIMIT - weekWorked}시간</span>
            </div>
          </div>
        </GwCard>

        <GwCard className="flex min-w-[300px] flex-[1_1_300px] flex-col gap-4 p-5.5">
          <div className="flex items-center gap-2">
            <Palmtree className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">
              연차 잔여 현황
            </h3>
            <span className="ml-auto text-[11.5px] text-muted-foreground">
              2026 회계연도
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              ["총 연차", "15", "#f8fafc", "#eef1f5", "#0f172a"],
              ["사용", "5", "#f8fafc", "#eef1f5", "#64748b"],
              ["잔여", "10", "#f5f6ff", "#e0e7ff", "#3730a3"],
            ].map(([label, v, bg, bd, fg]) => (
              <div
                key={label}
                className="rounded-[11px] border p-3"
                style={{ background: bg, borderColor: bd }}
              >
                <div className="text-[11.5px] text-muted-foreground">
                  {label}
                </div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span
                    className="text-2xl font-semibold tracking-[-0.03em] tabular-nums"
                    style={{ color: fg }}
                  >
                    {v}
                  </span>
                  <span className="text-xs text-muted-foreground">일</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="flex h-2 overflow-hidden rounded-full bg-[#eef1f5]">
              <div className="w-1/3 bg-primary" />
            </div>
            <div className="mt-1.5 flex justify-between text-[11.5px] text-muted-foreground">
              <span>사용률 33%</span>
              <span>소멸 예정 2026.12.31</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-[#f1f5f9] pt-3">
            <div className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
              최근 사용 내역
            </div>
            {LEAVE_HISTORY.map((l) => (
              <div key={l.date} className="flex items-center gap-2.5 text-[12.5px]">
                <span
                  style={pill(
                    l.type === "반차" ? "#f5f3ff" : "#eef2ff",
                    l.type === "반차" ? "#6d28d9" : "#4338ca",
                  )}
                >
                  {l.type}
                </span>
                <span className="flex-1 truncate text-secondary-foreground">
                  {l.date}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {l.days}
                </span>
              </div>
            ))}
          </div>
        </GwCard>
      </div>

      <GwCard>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#eef1f5] px-4.5 py-3.5">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              {
                value: "calendar",
                label: "월별 달력 뷰",
                icon: <CalendarDays className="size-3.5" />,
              },
              {
                value: "list",
                label: "일별 리스트 뷰",
                icon: <List className="size-3.5" />,
              },
            ]}
          />
          <div className="ml-auto flex items-center gap-2.5">
            <span className="text-[13px] font-semibold">2026년 9월</span>
            <div className="flex gap-1">
              <button className="flex size-[30px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary">
                <ChevronLeft className="size-[15px]" />
              </button>
              <button className="flex size-[30px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary">
                <ChevronRight className="size-[15px]" />
              </button>
            </div>
          </div>
        </div>

        {view === "calendar" ? (
          <div className="px-4.5 pb-5 pt-4">
            <div className="mb-2 grid grid-cols-7 gap-2">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className="py-1 text-center text-[11.5px] font-semibold"
                  style={{
                    color: i === 0 ? "#e11d48" : i === 6 ? "#4f46e5" : "#94a3b8",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">{cells}</div>
            <div className="mt-4 flex flex-wrap gap-3.5">
              {LEGEND.map((l) => (
                <div
                  key={l.label}
                  className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"
                >
                  <span
                    className="size-2 rounded-[3px]"
                    style={{ background: l.c }}
                  />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-[660px] border-b border-[#eef1f5] bg-secondary px-4.5 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
              <div className="w-24 shrink-0">날짜</div>
              <div className="w-[72px] shrink-0">출근</div>
              <div className="w-[72px] shrink-0">퇴근</div>
              <div className="w-[84px] shrink-0">근무시간</div>
              <div className="min-w-[120px] flex-1">근무 분포</div>
              <div className="w-[84px] shrink-0 text-right">상태</div>
            </div>
            {history.map((d) => {
              const tp = ATT_TYPE_COLORS[d.type];
              return (
                <div
                  key={d.day}
                  className="flex min-w-[660px] items-center border-b border-[#f1f5f9] px-4.5 py-3 text-[12.5px] transition-colors hover:bg-secondary"
                >
                  <div className="w-24 shrink-0 font-semibold">{d.day}</div>
                  <div className="w-[72px] shrink-0 tabular-nums text-secondary-foreground">
                    {d.in}
                  </div>
                  <div className="w-[72px] shrink-0 tabular-nums text-secondary-foreground">
                    {d.out}
                  </div>
                  <div className="w-[84px] shrink-0 font-semibold tabular-nums">
                    {d.hours}
                  </div>
                  <div className="min-w-[120px] flex-1 pr-4.5">
                    <div className="h-[7px] overflow-hidden rounded-full bg-[#f1f5f9]">
                      <div
                        className="h-full rounded-full"
                        style={{ background: d.color, width: `${d.pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-[84px] shrink-0 text-right">
                    <span style={pill(tp[0], tp[1])}>{d.type}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GwCard>
    </div>
  );
}
