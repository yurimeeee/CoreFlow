"use client";

import * as React from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RESOURCES } from "@/lib/groupware/data";
import { EVENT_CATEGORIES, type EventDoc } from "@/lib/groupware/firestore";
import {
  useBookings,
  useCurrentUser,
  useEvents,
  useLeaves,
  type EventInput,
} from "@/lib/groupware/hooks";
import { GwCard, PageHeader } from "@/components/app/primitives";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const two = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const todayStr = ymd(new Date());

type DayItem = {
  key: string;
  label: string;
  color: string;
  kind: "event" | "booking" | "leave";
  time?: string;
  event?: EventDoc;
};

export default function CalendarPage() {
  const me = useCurrentUser();
  const { data: events, myUid, addEvent, saveEvent, removeEvent } = useEvents();
  const { data: bookings } = useBookings();
  const { data: leaves } = useLeaves();

  const [cursor, setCursor] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [modal, setModal] = React.useState<
    { mode: "new"; date: string } | { mode: "edit"; event: EventDoc } | null
  >(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const cells = React.useMemo(() => {
    const monthStart = new Date(year, month, 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(1 - monthStart.getDay());
    const resName = (key: string) =>
      RESOURCES.find((r) => r.key === key)?.name ?? key;
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const ds = ymd(d);
      const items: DayItem[] = [];

      events
        .filter((e) => e.date <= ds && (e.end || e.date) >= ds)
        .forEach((e) =>
          items.push({
            key: `e-${e.id}`,
            label: e.title,
            color: e.color,
            kind: "event",
            time: e.allDay ? undefined : e.start,
            event: e,
          }),
        );

      bookings
        .filter((b) => b.date === ds)
        .forEach((b) =>
          items.push({
            key: `b-${b.id}`,
            label: `${resName(b.res)} · ${b.title || "예약"}`,
            color: "#0ea5e9",
            kind: "booking",
          }),
        );

      leaves
        .filter(
          (l) => l.status !== "반려" && l.start <= ds && (l.end || l.start) >= ds,
        )
        .forEach((l) =>
          items.push({
            key: `l-${l.id}`,
            label: `${l.who} · ${l.kind}`,
            color: "#16a34a",
            kind: "leave",
          }),
        );

      return {
        date: d,
        ds,
        inMonth: d.getMonth() === month,
        isToday: ds === todayStr,
        items,
      };
    });
  }, [year, month, events, bookings, leaves]);

  const monthEventCount = events.filter(
    (e) => e.date.slice(0, 7) === `${year}-${two(month + 1)}`,
  ).length;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <PageHeader
        title="캘린더"
        desc={`${year}년 ${month + 1}월 · 내 일정 ${monthEventCount}건 · 예약·휴가 통합`}
        actions={
          <button
            onClick={() => setModal({ mode: "new", date: todayStr })}
            className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
          >
            <CalendarPlus className="size-4" />새 일정
          </button>
        }
      />

      <GwCard className="flex flex-col p-3 sm:p-4">
        <div className="flex items-center gap-2 px-1 pb-3">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="flex size-8 items-center justify-center rounded-[9px] border border-border bg-card text-secondary-foreground hover:bg-secondary"
            aria-label="이전 달"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="flex size-8 items-center justify-center rounded-[9px] border border-border bg-card text-secondary-foreground hover:bg-secondary"
            aria-label="다음 달"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="ml-1 text-[15px] font-bold tracking-[-0.02em]">
            {year}년 {month + 1}월
          </div>
          <button
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="ml-auto h-8 rounded-[9px] border border-border bg-card px-3 text-[12px] font-semibold text-secondary-foreground hover:bg-secondary"
          >
            오늘
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn(
                "px-2 pb-2 text-center text-[11.5px] font-semibold",
                i === 0 ? "text-[#e11d48]" : "text-muted-foreground",
              )}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((c) => (
            <button
              key={c.ds}
              onClick={() => setModal({ mode: "new", date: c.ds })}
              className={cn(
                "flex min-h-[104px] flex-col gap-1 border-b border-r border-[#f1f5f9] p-1.5 text-left transition-colors hover:bg-secondary/60",
                !c.inMonth && "bg-[#fafbfc]",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center self-start rounded-full text-[11.5px] tabular-nums",
                  c.isToday
                    ? "bg-primary font-bold text-white"
                    : c.inMonth
                      ? "text-secondary-foreground"
                      : "text-[#cbd5e1]",
                  !c.isToday &&
                    c.date.getDay() === 0 &&
                    c.inMonth &&
                    "text-[#e11d48]",
                )}
              >
                {c.date.getDate()}
              </span>
              {c.items.slice(0, 3).map((it) => (
                <span
                  key={it.key}
                  onClick={(e) => {
                    if (it.kind === "event" && it.event) {
                      e.stopPropagation();
                      setModal({ mode: "edit", event: it.event });
                    }
                  }}
                  className="flex items-center gap-1 truncate rounded-[5px] px-1 py-0.5 text-[10.5px] font-medium"
                  style={{
                    background: `${it.color}1a`,
                    color: it.color,
                  }}
                >
                  <span
                    className="size-1 shrink-0 rounded-full"
                    style={{ background: it.color }}
                  />
                  {it.time ? `${it.time} ` : ""}
                  {it.label}
                </span>
              ))}
              {c.items.length > 3 && (
                <span className="px-1 text-[10px] font-semibold text-muted-foreground">
                  +{c.items.length - 3}건
                </span>
              )}
            </button>
          ))}
        </div>
      </GwCard>

      <div className="flex flex-wrap items-center gap-3 px-1 text-[11.5px] text-muted-foreground">
        {EVENT_CATEGORIES.map((c) => (
          <span key={c.key} className="flex items-center gap-1">
            <span
              className="size-2 rounded-full"
              style={{ background: c.color }}
            />
            {c.key}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-[#0ea5e9]" />
          예약
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-[#16a34a]" />
          휴가
        </span>
      </div>

      {modal && (
        <EventModal
          key={modal.mode === "edit" ? modal.event.id : `new-${modal.date}`}
          initial={
            modal.mode === "edit"
              ? modal.event
              : {
                  title: "",
                  date: modal.date,
                  end: modal.date,
                  start: "10:00",
                  finish: "11:00",
                  allDay: false,
                  category: "회의",
                  location: "",
                  memo: "",
                }
          }
          canEdit={modal.mode === "new" || modal.event.owner === myUid}
          ownerName={modal.mode === "edit" ? modal.event.ownerName : me.name}
          onClose={() => setModal(null)}
          onSave={async (input) => {
            if (modal.mode === "edit") await saveEvent(modal.event.id, input);
            else await addEvent(input);
            setModal(null);
          }}
          onDelete={
            modal.mode === "edit" && modal.event.owner === myUid
              ? async () => {
                  await removeEvent(modal.event.id);
                  setModal(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function EventModal({
  initial,
  canEdit,
  ownerName,
  onClose,
  onSave,
  onDelete,
}: {
  initial: EventInput | EventDoc;
  canEdit: boolean;
  ownerName: string;
  onClose: () => void;
  onSave: (input: EventInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = React.useState(initial.title);
  const [category, setCategory] = React.useState(initial.category);
  const [date, setDate] = React.useState(initial.date);
  const [end, setEnd] = React.useState(initial.end || initial.date);
  const [allDay, setAllDay] = React.useState(initial.allDay);
  const [start, setStart] = React.useState(initial.start || "10:00");
  const [finish, setFinish] = React.useState(initial.finish || "11:00");
  const [location, setLocation] = React.useState(initial.location);
  const [memo, setMemo] = React.useState(initial.memo);
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({
        title,
        date,
        end: end < date ? date : end,
        start,
        finish,
        allDay,
        category,
        location,
        memo,
      });
    } finally {
      setBusy(false);
    }
  };

  const field =
    "h-9 w-full rounded-[8px] border border-border bg-card px-2.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4"
      onClick={onClose}
    >
      <div
        className="animate-step flex w-full max-w-[440px] flex-col gap-4 rounded-[14px] border border-border bg-card p-5 shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold tracking-[-0.02em]">
            {canEdit ? (onDelete ? "일정 편집" : "새 일정") : "일정 상세"}
          </span>
          <button
            onClick={onClose}
            className="ml-auto flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        {!canEdit ? (
          <div className="flex flex-col gap-2.5 text-[13px]">
            <div className="text-[15px] font-semibold">{initial.title}</div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" />
              {date}
              {end && end !== date ? ` ~ ${end}` : ""}
              {!allDay && ` · ${start}–${finish}`}
              {allDay && " · 종일"}
            </div>
            {initial.location && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="size-3.5" />
                {initial.location}
              </div>
            )}
            {initial.memo && (
              <p className="whitespace-pre-wrap rounded-[8px] bg-secondary p-2.5 text-secondary-foreground">
                {initial.memo}
              </p>
            )}
            <span className="text-[11.5px] text-muted-foreground">
              작성자 {ownerName} · 본인 일정만 편집할 수 있습니다
            </span>
          </div>
        ) : (
          <>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목"
              className={cn(field, "font-medium")}
            />

            <div className="flex flex-wrap gap-1.5">
              {EVENT_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={cn(
                    "h-7 rounded-[7px] border px-2.5 text-[12px] font-semibold transition-colors",
                    category === c.key
                      ? "text-white"
                      : "border-border bg-card text-secondary-foreground hover:bg-secondary",
                  )}
                  style={
                    category === c.key
                      ? { background: c.color, borderColor: c.color }
                      : undefined
                  }
                >
                  {c.key}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-secondary-foreground">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
                종일
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
                시작일
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={field}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
                종료일
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={field}
                />
              </label>
              {!allDay && (
                <>
                  <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
                    시작 시각
                    <input
                      type="time"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className={field}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
                    종료 시각
                    <input
                      type="time"
                      value={finish}
                      onChange={(e) => setFinish(e.target.value)}
                      className={field}
                    />
                  </label>
                </>
              )}
            </div>

            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="장소 (선택)"
              className={field}
            />
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="메모 (선택)"
              className="w-full resize-none rounded-[8px] border border-border bg-card px-2.5 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="flex h-9 items-center gap-1.5 rounded-[9px] border border-[#fecaca] bg-card px-3 text-[12.5px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2]"
                >
                  <Trash2 className="size-3.5" />
                  삭제
                </button>
              )}
              <button
                onClick={onClose}
                className="ml-auto h-9 rounded-[9px] border border-border bg-card px-3.5 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
              >
                취소
              </button>
              <button
                onClick={submit}
                disabled={busy || !title.trim()}
                className="h-9 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
