"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Home,
  List,
  LogIn,
  LogOut,
  Palmtree,
  Timer,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATT_DAY_DATA,
  ATT_OOO,
  ATT_TYPE_COLORS,
  OOO_COLORS,
  WEEK_LIMIT,
  WEEK_WARN,
} from "@/lib/groupware/data";
import { avatarStyle, pill } from "@/lib/groupware/ui";
import { useNow } from "@/lib/groupware/use-now";
import {
  useAttendance,
  useLeaves,
  usePendingLeaves,
} from "@/lib/groupware/hooks";
import { GwCard, PageHeader, Segmented, Toggle } from "@/components/app/primitives";
import { LeaveRequestModal } from "./LeaveRequestModal";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const two = (n: number) => String(n).padStart(2, "0");
const LIMIT = WEEK_LIMIT;

const LEGEND: { label: string; c: string; ring?: boolean }[] = [
  { label: "정상근무", c: "#4f46e5" },
  { label: "지각", c: "#f59e0b" },
  { label: "연장근무", c: "#e11d48" },
  { label: "재택", c: "#16a34a" },
  { label: "연차", c: "#94a3b8" },
  { label: "팀원 부재(OOO)", c: "#cbd5e1", ring: true },
];

export default function AttendancePage() {
  const now = useNow();
  const { working, inAt, outAt, weekWorked, history, checkIn, checkOut } =
    useAttendance();
  const { data: leaves, balance, addLeave, cancelLeave } = useLeaves();
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const pending = usePendingLeaves();
  const [view, setView] = React.useState<"calendar" | "list">("calendar");
  const [remoteToday, setRemoteToday] = React.useState(false);
  const [leaveModal, setLeaveModal] = React.useState<"leave" | "overtime" | null>(
    null,
  );
  const [cal, setCal] = React.useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const shiftMonth = (delta: number) =>
    setCal(({ y, m }) => {
      const next = new Date(y, m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  const firstWeekday = new Date(cal.y, cal.m, 1).getDay();
  const daysInMonth = new Date(cal.y, cal.m + 1, 0).getDate();
  const isCurrentMonth =
    !!now && now.getFullYear() === cal.y && now.getMonth() === cal.m;

  const clock = now ? `${two(now.getHours())}:${two(now.getMinutes())}` : "--:--";
  const seconds = now ? `:${two(now.getSeconds())}` : ":--";
  const pct = Math.min(100, Math.round((weekWorked / LIMIT) * 1000) / 10);
  const warnPct = Math.round((WEEK_WARN / LIMIT) * 1000) / 10;
  const zone: "normal" | "warn" | "over" =
    weekWorked >= LIMIT ? "over" : weekWorked >= WEEK_WARN ? "warn" : "normal";
  const barColor =
    zone === "over"
      ? "linear-gradient(90deg, #f43f5e, #e11d48)"
      : zone === "warn"
        ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
        : "linear-gradient(90deg, #6366f1, #4f46e5)";
  const zoneLabel =
    zone === "over" ? "법정 한도 초과" : zone === "warn" ? "경고 구간 (45h 초과)" : "정상 구간";

  const badges: { label: string; bg: string; fg: string }[] = [];
  if (working) badges.push({ label: "근무 중", bg: "#f0fdf4", fg: "#15803d" });
  else if (outAt !== "--:--")
    badges.push({ label: "퇴근 완료", bg: "#f1f5f9", fg: "#475569" });
  else badges.push({ label: "출근 전", bg: "#fff7ed", fg: "#c2410c" });
  if (inAt !== "--:--" && inAt > "09:10")
    badges.push({ label: "지각", bg: "#fef2f2", fg: "#b91c1c" });
  if (remoteToday)
    badges.push({ label: "재택근무", bg: "#eef2ff", fg: "#4338ca" });

  const todayWorked = (() => {
    if (inAt === "--:--") return "--";
    const [ih, im] = inAt.split(":").map(Number);
    const end = outAt !== "--:--" ? outAt : clock;
    const [oh, om] = end.split(":").map(Number);
    const mins = oh * 60 + om - (ih * 60 + im);
    if (!Number.isFinite(mins) || mins <= 0) return "--";
    return `${Math.round((mins / 60) * 10) / 10}h`;
  })();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(
      <div key={`e${i}`} className="min-h-[84px] rounded-[10px] bg-[#fbfcfe]" />,
    );
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const rec = ATT_DAY_DATA[d];
    const wd = new Date(cal.y, cal.m, d).getDay();
    const weekend = wd === 0 || wd === 6;
    const today = isCurrentMonth && d === now?.getDate();
    const tc = rec ? ATT_TYPE_COLORS[rec[2]] : null;
    const ooo = (ATT_OOO[d] ?? []).slice(0, 4);
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
        {ooo.length > 0 && (
          <div className={cn("flex items-center", !rec && "mt-auto")}>
            {ooo.map(([name, kind], oi) => (
              <span
                key={name + kind}
                title={`${name} · ${kind}`}
                className="flex size-[18px] items-center justify-center rounded-full border-[1.5px] border-white text-[9px] font-bold text-white"
                style={{
                  background: OOO_COLORS[kind] ?? "#94a3b8",
                  marginLeft: oi === 0 ? 0 : -6,
                }}
              >
                {name.charAt(0)}
              </span>
            ))}
          </div>
        )}
      </div>,
    );
  }

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-4.5">
      <PageHeader
        title="출퇴근 / 근태 관리"
        desc={now ? `${now.getFullYear()}년 ${now.getMonth() + 1}월` : ""}
        actions={
          <>
            <button
              onClick={() => setLeaveModal("leave")}
              className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-semibold text-secondary-foreground hover:bg-secondary"
            >
              <Palmtree className="size-4 text-primary" />
              연차 / 반차 신청
            </button>
            <button
              onClick={() => setLeaveModal("overtime")}
              className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
            >
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
            <div className="ml-auto flex flex-col items-end gap-1.5">
              <div className="text-[11.5px] text-muted-foreground">
                {now
                  ? `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`
                  : ""}
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {badges.map((b) => (
                  <span key={b.label} style={pill(b.bg, b.fg)}>
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-secondary px-3 py-2">
            <Home className="size-4 text-muted-foreground" />
            <span className="text-[12.5px] font-semibold text-secondary-foreground">
              오늘 재택근무
            </span>
            <span className="text-[11px] text-muted-foreground">
              {remoteToday ? "재택근무로 표시됩니다" : "사무실 출근 기준입니다"}
            </span>
            <Toggle
              size="sm"
              on={remoteToday}
              onClick={() => setRemoteToday((v) => !v)}
              className="ml-auto"
            />
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
              ["오늘 근무", todayWorked],
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
              <span
                style={
                  weekWorked > 40
                    ? pill("#fef2f2", "#b91c1c")
                    : pill("#f0fdf4", "#15803d")
                }
              >
                {weekWorked > 40
                  ? `연장근로 ${weekWorked - 40}시간`
                  : "소정근로 내 · 연장 여유 12시간"}
              </span>
              <span className="ml-auto text-[13px] font-semibold tabular-nums">
                {weekWorked}시간 / {LIMIT}시간
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-[#eef1f5]">
              <div
                className="h-full overflow-hidden rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: barColor }}
              />
              <div
                className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-sm bg-[#f59e0b]"
                style={{ left: `${warnPct}%` }}
              />
              <div className="absolute -top-[3px] -bottom-[3px] right-0 w-0.5 rounded-sm bg-[#e11d48]" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-[#cbd5e1]">
              <span>0h</span>
              <span>경고 {WEEK_WARN}h</span>
              <span>한도 {LIMIT}h</span>
            </div>
            <div className="mt-1 flex justify-between text-[11.5px] text-muted-foreground">
              <span>소정 40h + 연장 12h · {zoneLabel}</span>
              <span>잔여 {Math.round((LIMIT - weekWorked) * 10) / 10}시간</span>
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
              {now ? now.getFullYear() : ""} 회계연도
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                ["총 연차", balance.total, "#f8fafc", "#eef1f5", "#0f172a"],
                ["사용", balance.used, "#f8fafc", "#eef1f5", "#64748b"],
                ["잔여", balance.remaining, "#f5f6ff", "#e0e7ff", "#3730a3"],
              ] as [string, number, string, string, string][]
            ).map(([label, v, bg, bd, fg]) => (
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
              <div
                className="bg-primary transition-[width]"
                style={{
                  width: `${Math.min(100, Math.round((balance.used / balance.total) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11.5px] text-muted-foreground">
              <span>
                사용률{" "}
                {Math.round((balance.used / balance.total) * 100)}%
              </span>
              <span>소멸 예정 {now ? now.getFullYear() : ""}.12.31</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-[#f1f5f9] pt-3">
            <div className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
              최근 신청 내역
            </div>
            {leaves.length === 0 && (
              <div className="py-2 text-[12px] text-muted-foreground">
                신청 내역이 없습니다
              </div>
            )}
            {leaves.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center gap-2.5 text-[12.5px]">
                <span
                  style={pill(
                    l.kind === "반차"
                      ? "#f5f3ff"
                      : l.kind === "초과근무"
                        ? "#fff7ed"
                        : "#eef2ff",
                    l.kind === "반차"
                      ? "#6d28d9"
                      : l.kind === "초과근무"
                        ? "#c2410c"
                        : "#4338ca",
                  )}
                >
                  {l.kind}
                </span>
                <span className="flex-1 truncate text-secondary-foreground">
                  {l.start}
                  {l.end !== l.start ? ` ~ ${l.end}` : ""}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {l.kind === "초과근무" ? `${l.hours}h` : `${l.days}일`}
                </span>
                <span
                  style={pill(
                    l.status === "승인"
                      ? "#f0fdf4"
                      : l.status === "반려"
                        ? "#fef2f2"
                        : "#fff7ed",
                    l.status === "승인"
                      ? "#15803d"
                      : l.status === "반려"
                        ? "#b91c1c"
                        : "#c2410c",
                  )}
                >
                  {l.status}
                </span>
                {l.status === "대기" && (
                  <button
                    onClick={async () => {
                      if (cancellingId) return;
                      setCancellingId(l.id);
                      try {
                        await cancelLeave(l.id);
                      } finally {
                        setCancellingId(null);
                      }
                    }}
                    disabled={cancellingId === l.id}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-[#fef2f2] hover:text-[#b91c1c] disabled:opacity-50"
                  >
                    {cancellingId === l.id ? "취소 중…" : "신청 취소"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </GwCard>
      </div>

      {pending.isAdmin && (
        <GwCard className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-[#eef1f5] px-4.5 py-3.5">
            <ClipboardCheck className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">
              연차·근태 승인 대기
            </h3>
            <span
              style={pill(
                pending.data.length ? "#fff7ed" : "#f1f5f9",
                pending.data.length ? "#c2410c" : "#94a3b8",
              )}
            >
              {pending.data.length}건
            </span>
            <span className="ml-auto text-[11.5px] text-muted-foreground">
              결재자 승인
            </span>
          </div>

          {pending.data.length === 0 ? (
            <p className="px-4.5 py-8 text-center text-[12.5px] text-muted-foreground">
              {pending.loading
                ? "불러오는 중…"
                : "승인 대기 중인 신청이 없습니다"}
            </p>
          ) : (
            pending.data.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] px-4.5 py-3 last:border-0"
              >
                <span style={avatarStyle(l.who.charAt(0), 32)}>
                  {l.who.charAt(0)}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">
                    {l.who}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {l.kind}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {l.start}
                    {l.end !== l.start ? ` ~ ${l.end}` : ""} ·{" "}
                    {l.kind === "초과근무" ? `${l.hours}시간` : `${l.days}일`}
                    {l.reason ? ` · ${l.reason}` : ""}
                  </div>
                </div>
                <div className="ml-auto flex gap-1.5">
                  <button
                    onClick={() => pending.reject(l.id)}
                    className="flex h-8 items-center gap-1 rounded-[8px] border border-[#fecaca] bg-card px-2.5 text-[12px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2]"
                  >
                    <X className="size-3.5" />
                    반려
                  </button>
                  <button
                    onClick={() => pending.approve(l.id)}
                    className="flex h-8 items-center gap-1 rounded-[8px] bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary-hover"
                  >
                    <Check className="size-3.5" strokeWidth={2.6} />
                    승인
                  </button>
                </div>
              </div>
            ))
          )}
        </GwCard>
      )}

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
            <span className="text-[13px] font-semibold tabular-nums">
              {cal.y}년 {cal.m + 1}월
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => shiftMonth(-1)}
                aria-label="이전 달"
                className="flex size-[30px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary"
              >
                <ChevronLeft className="size-[15px]" />
              </button>
              {!isCurrentMonth && (
                <button
                  onClick={() =>
                    setCal(() => {
                      const d = new Date();
                      return { y: d.getFullYear(), m: d.getMonth() };
                    })
                  }
                  className="flex h-[30px] items-center rounded-lg border border-border bg-card px-2.5 text-[11.5px] font-semibold text-secondary-foreground hover:bg-secondary"
                >
                  오늘
                </button>
              )}
              <button
                onClick={() => shiftMonth(1)}
                aria-label="다음 달"
                className="flex size-[30px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary"
              >
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
                    className={cn("size-2", l.ring ? "rounded-full" : "rounded-[3px]")}
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

      {leaveModal && (
        <LeaveRequestModal
          mode={leaveModal}
          remaining={balance.remaining}
          onClose={() => setLeaveModal(null)}
          onSubmit={async (input) => {
            await addLeave(input);
            setLeaveModal(null);
          }}
        />
      )}
    </div>
  );
}
