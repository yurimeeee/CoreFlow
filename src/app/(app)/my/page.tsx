"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronRight,
  FileCheck2,
  Megaphone,
  Palmtree,
  SquareKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RESOURCES } from "@/lib/groupware/data";
import {
  useApprovals,
  useBookings,
  useCurrentUser,
  useEvents,
  useLeaves,
  useNotices,
  useTasks,
} from "@/lib/groupware/hooks";
import { ddayStyle, pill } from "@/lib/groupware/ui";
import { GwCard, PageHeader, StatCard, Tag } from "@/components/app/primitives";

const two = (n: number) => String(n).padStart(2, "0");
const todayStr = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
})();

export default function MyWorkPage() {
  const me = useCurrentUser();
  const { data: approvals } = useApprovals();
  const { data: tasks, toggleDone } = useTasks();
  const { data: events } = useEvents();
  const { data: bookings } = useBookings();
  const { data: leaves, balance } = useLeaves();
  const { data: notices } = useNotices();

  const myApprovals = approvals.filter((a) => a.bucket === "pending");
  const myTasks = tasks
    .filter(
      (t) =>
        // assigneeId 가 있으면 uid 기준(신뢰도 높음), 없는 과거 Task는 이름으로 폴백
        (t.assigneeId ? t.assigneeId === me.uid : t.who === me.name) &&
        t.colKey !== "done",
    )
    .sort((a, b) => a.order - b.order);
  const unreadNotices = notices.filter((n) => n.unread);

  const resName = (key: string) =>
    RESOURCES.find((r) => r.key === key)?.name ?? key;

  const todaySchedule = [
    ...events
      .filter((e) => e.date <= todayStr && (e.end || e.date) >= todayStr)
      .map((e) => ({
        id: `e-${e.id}`,
        time: e.allDay ? "종일" : e.start,
        title: e.title,
        place: e.location || e.category,
        color: e.color,
      })),
    ...bookings
      .filter((b) => b.date === todayStr && b.who === me.name)
      .map((b) => ({
        id: `b-${b.id}`,
        time: "예약",
        title: b.title || "자원 예약",
        place: resName(b.res),
        color: "#0ea5e9",
      })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  const recentLeaves = leaves.slice(0, 4);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <PageHeader
        title="내 업무"
        desc={`${me.name}${me.role ? ` ${me.role}` : ""}님에게 배정된 결재·Task·일정을 한눈에`}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <StatCard
          label="결재 대기"
          value={myApprovals.length}
          icon={<FileCheck2 className="size-[17px] text-[#4338ca]" />}
          iconBg="#eef2ff"
        />
        <StatCard
          label="진행 중 Task"
          value={myTasks.length}
          icon={<SquareKanban className="size-[17px] text-[#6d28d9]" />}
          iconBg="#f5f3ff"
        />
        <StatCard
          label="오늘 일정"
          value={todaySchedule.length}
          icon={<CalendarDays className="size-[17px] text-[#0ea5e9]" />}
          iconBg="#e0f2fe"
        />
        <StatCard
          label="연차 잔여"
          value={balance.remaining}
          unit={`/ ${balance.total}일`}
          icon={<Palmtree className="size-[17px] text-[#16a34a]" />}
          iconBg="#f0fdf4"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 결재 대기 */}
        <GwCard className="flex flex-col gap-3 p-4.5">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold">나에게 온 결재</h3>
            <Link
              href="/approval"
              className="ml-auto flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-semibold text-primary hover:bg-accent"
            >
              전체 <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="flex flex-col">
            {myApprovals.slice(0, 5).map((d) => (
              <Link
                href={`/approval/${d.no}`}
                key={d.no}
                className="flex items-center gap-2.5 border-b border-[#f1f5f9] py-2.5 last:border-0 hover:pl-1.5"
              >
                <span style={pill("#eef2ff", "#4338ca")}>{d.type}</span>
                <span className="flex-1 truncate text-[12.5px]">{d.title}</span>
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  {d.author}
                </span>
              </Link>
            ))}
            {myApprovals.length === 0 && (
              <p className="py-6 text-center text-[12px] text-muted-foreground">
                대기 중인 결재가 없습니다
              </p>
            )}
          </div>
        </GwCard>

        {/* 내 Task */}
        <GwCard className="flex flex-col gap-3 p-4.5">
          <div className="flex items-center gap-2">
            <SquareKanban className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold">내 담당 Task</h3>
            <Link
              href="/tasks"
              className="ml-auto flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-semibold text-primary hover:bg-accent"
            >
              보드 <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="flex flex-col">
            {myTasks.slice(0, 6).map((t) => {
              const complete = t.total > 0 && t.done === t.total;
              return (
                <button
                  key={t.id}
                  onClick={() => toggleDone(t)}
                  className="flex items-center gap-2.5 border-b border-[#f1f5f9] py-2.5 text-left last:border-0 hover:pl-1.5"
                >
                  <span
                    className={cn(
                      "flex size-[17px] shrink-0 items-center justify-center rounded-[5px]",
                      complete
                        ? "bg-primary text-white"
                        : "border-[1.5px] border-[#cbd5e1] bg-card",
                    )}
                  >
                    {complete && <Check className="size-[11px]" strokeWidth={3} />}
                  </span>
                  <span
                    className={cn(
                      "flex-1 truncate text-[12.5px]",
                      complete
                        ? "text-muted-foreground line-through"
                        : "font-medium",
                    )}
                  >
                    {t.title}
                  </span>
                  <Tag label={t.tag} />
                  <span style={ddayStyle(t.dday)}>{t.dday}</span>
                </button>
              );
            })}
            {myTasks.length === 0 && (
              <p className="py-6 text-center text-[12px] text-muted-foreground">
                담당 중인 Task가 없습니다
              </p>
            )}
          </div>
        </GwCard>

        {/* 오늘 일정 */}
        <GwCard className="flex flex-col gap-3 p-4.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold">오늘 일정</h3>
            <Link
              href="/calendar"
              className="ml-auto flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-semibold text-primary hover:bg-accent"
            >
              캘린더 <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="flex flex-col gap-1.5">
            {todaySchedule.map((s) => (
              <div key={s.id} className="flex gap-2.5 rounded-[9px] px-1 py-1.5">
                <div className="w-11 shrink-0 pt-px text-[11.5px] tabular-nums text-muted-foreground">
                  {s.time}
                </div>
                <div
                  className="w-0.5 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">
                    {s.title}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {s.place}
                  </div>
                </div>
              </div>
            ))}
            {todaySchedule.length === 0 && (
              <p className="py-6 text-center text-[12px] text-muted-foreground">
                오늘 예정된 일정이 없습니다
              </p>
            )}
          </div>
        </GwCard>

        {/* 휴가 · 공지 */}
        <GwCard className="flex flex-col gap-3 p-4.5">
          <div className="flex items-center gap-2">
            <Palmtree className="size-4 text-primary" />
            <h3 className="text-[13.5px] font-semibold">내 휴가 · 공지</h3>
            <Link
              href="/attendance"
              className="ml-auto flex items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-semibold text-primary hover:bg-accent"
            >
              근태 <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="rounded-[10px] bg-secondary p-3 text-[12px]">
            <span className="font-semibold">연차</span> · 사용{" "}
            {balance.used}일 / 잔여{" "}
            <span className="font-semibold text-primary">
              {balance.remaining}일
            </span>
          </div>
          <div className="flex flex-col">
            {recentLeaves.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 border-b border-[#f1f5f9] py-2 text-[12px] last:border-0"
              >
                <span style={pill("#f0fdf4", "#15803d")}>{l.kind}</span>
                <span className="flex-1 truncate text-secondary-foreground">
                  {l.start}
                  {l.end && l.end !== l.start ? ` ~ ${l.end}` : ""}
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
              </div>
            ))}
            {recentLeaves.length === 0 && (
              <p className="py-4 text-center text-[12px] text-muted-foreground">
                최근 신청 내역이 없습니다
              </p>
            )}
          </div>
          {unreadNotices.length > 0 && (
            <Link
              href="/notice"
              className="flex items-center gap-2 rounded-[9px] border border-[#e0e7ff] bg-[#f5f6ff] px-3 py-2 text-[12px] font-semibold text-[#4338ca] hover:bg-[#eef2ff]"
            >
              <Megaphone className="size-3.5" />안 읽은 공지 {unreadNotices.length}건
              <ChevronRight className="ml-auto size-3.5" />
            </Link>
          )}
        </GwCard>
      </div>
    </div>
  );
}
