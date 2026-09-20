"use client";

import * as React from "react";
import {
  Car,
  Check,
  DoorOpen,
  Laptop,
  Plus,
  Presentation,
  Projector,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BOOK_PROVIDERS,
  BOOK_PURPOSES,
  BOOKING_SLOTS,
  RES_CAP_FILTERS,
  RES_CAP_MAP,
  RES_EQUIP_FILTERS,
  RES_TYPES,
  RESOURCES,
  slotLabel,
  type ResourceType,
} from "@/lib/groupware/data";
import type { BookingDoc } from "@/lib/groupware/firestore";
import { avatarStyle } from "@/lib/groupware/ui";
import { useBookings, useCurrentUser, useOrgPeople } from "@/lib/groupware/hooks";
import { GwCard, PageHeader, Toggle } from "@/components/app/primitives";

const RES_ICONS: Record<string, React.ElementType> = {
  DoorOpen,
  Car,
  Laptop,
  Projector,
  Presentation,
};

function ResIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = RES_ICONS[name] ?? DoorOpen;
  return <Cmp className={className} />;
}

const two = (n: number) => String(n).padStart(2, "0");

export default function BookingPage() {
  const { people: directory } = useOrgPeople();
  const { data: allBookings, addBooking, removeBooking } = useBookings();
  const me = useCurrentUser();

  const [resType, setResType] = React.useState<ResourceType>("회의실");
  const [resCap, setResCap] = React.useState("전체");
  const [resEquip, setResEquip] = React.useState<Record<string, boolean>>({});
  const [selRes, setSelRes] = React.useState<string | null>(null);
  const [selStart, setSelStart] = React.useState<number | null>(null);
  const [selEnd, setSelEnd] = React.useState<number | null>(null);

  const draggingRef = React.useRef(false);
  const dragStartRef = React.useRef<number | null>(null);
  const movedRef = React.useRef(false);
  const anchorRef = React.useRef<{ res: string; index: number } | null>(null);

  const [bookOpen, setBookOpen] = React.useState(false);
  const [bookTitle, setBookTitle] = React.useState("");
  const [bookPurpose, setBookPurpose] = React.useState(BOOK_PURPOSES[0]);
  const [bookQuery, setBookQuery] = React.useState("");
  const [bookAtt, setBookAtt] = React.useState<number[]>([]);
  const [bookVideoOn, setBookVideoOn] = React.useState(true);
  const [bookProvider, setBookProvider] = React.useState(BOOK_PROVIDERS[0]);
  const [viewBooking, setViewBooking] = React.useState<BookingDoc | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const days = ["일", "월", "화", "수", "목", "금", "토"];

  // 타임라인은 "오늘" 하루만 보여주므로, 다른 날짜의 예약이 슬롯을 계속
  // 점유한 것처럼 보이지 않도록 오늘 자 예약만 사용합니다.
  const bookings = allBookings.filter((b) => b.date === todayStr);

  const bookedIn = React.useCallback(
    (resKey: string, i: number) =>
      bookings.some((b) => b.res === resKey && i >= b.from && i < b.to),
    [bookings],
  );
  const spanFree = React.useCallback(
    (resKey: string, from: number, to: number) => {
      for (let k = from; k < to; k++) if (bookedIn(resKey, k)) return false;
      return true;
    },
    [bookedIn],
  );

  const equipOn = Object.keys(resEquip).filter((k) => resEquip[k]);
  const resFiltered = RESOURCES.filter((r) => r.type === resType)
    .filter((r) => resCap === "전체" || r.cap === RES_CAP_MAP[resCap])
    .filter((r) => equipOn.every((e) => r.equip.includes(e)));

  const hasSel = selRes !== null && selStart !== null && selEnd !== null;
  const selResObj = hasSel ? RESOURCES.find((r) => r.key === selRes) : null;
  const selRangeLabel = hasSel
    ? `${slotLabel(selStart as number)} – ${slotLabel(selEnd as number)}`
    : "";
  const conflict = hasSel && !spanFree(selRes as string, selStart as number, selEnd as number);

  const clearSelection = () => {
    setSelRes(null);
    setSelStart(null);
    setSelEnd(null);
    anchorRef.current = null;
  };

  const endDrag = () => {
    draggingRef.current = false;
  };

  const handleMouseDown = (resKey: string, i: number, booked: boolean) => {
    if (booked) return;
    draggingRef.current = true;
    movedRef.current = false;
    dragStartRef.current = i;
    setSelRes(resKey);
    setSelStart(i);
    setSelEnd(i + 1);
  };

  const handleMouseEnter = (resKey: string, i: number, booked: boolean) => {
    if (booked || !draggingRef.current || dragStartRef.current === null) return;
    if (selRes !== resKey) return;
    movedRef.current = true;
    const from = Math.min(dragStartRef.current, i);
    const to = Math.max(dragStartRef.current, i) + 1;
    if (!spanFree(resKey, from, to)) return;
    setSelStart(from);
    setSelEnd(to);
  };

  const handleClick = (resKey: string, i: number, booked: boolean) => {
    if (booked) return;
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    const anchor = anchorRef.current;
    if (anchor && anchor.res === resKey && anchor.index !== i) {
      const from = Math.min(anchor.index, i);
      const to = Math.max(anchor.index, i) + 1;
      if (spanFree(resKey, from, to)) {
        setSelRes(resKey);
        setSelStart(from);
        setSelEnd(to);
      }
      anchorRef.current = null;
    } else {
      setSelRes(resKey);
      setSelStart(i);
      setSelEnd(i + 1);
      anchorRef.current = { res: resKey, index: i };
    }
  };

  const openNewBooking = () => {
    if (resFiltered.length === 0) return;
    if (!hasSel) {
      setSelRes(resFiltered[0].key);
      setSelStart(18);
      setSelEnd(20);
    }
    setBookOpen(true);
  };

  const closeBook = () => {
    setBookOpen(false);
    setBookQuery("");
  };

  const [saving, setSaving] = React.useState(false);

  const confirmBook = async () => {
    if (!hasSel || conflict || saving) return;
    setSaving(true);
    try {
      await addBooking({
        res: selRes as string,
        from: selStart as number,
        to: selEnd as number,
        title: bookTitle.trim() || bookPurpose,
        purpose: bookPurpose,
        attendees: bookAtt,
        video: bookVideoOn,
        provider: bookVideoOn ? bookProvider : "",
      });
    } finally {
      setSaving(false);
    }
    setBookOpen(false);
    setBookTitle("");
    setBookAtt([]);
    clearSelection();
  };

  const attendeePool = directory.filter((p) => p.id !== 0);
  const bq = bookQuery.trim().toLowerCase();
  const bookSuggest = bq
    ? attendeePool
        .filter(
          (p) =>
            !bookAtt.includes(p.id) &&
            (p.name + p.dept + p.role).toLowerCase().includes(bq),
        )
        .slice(0, 4)
    : [];

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
      <PageHeader
        title="회의실 · 자원 예약"
        desc={`${today.getFullYear()}.${two(today.getMonth() + 1)}.${two(today.getDate())} (${days[today.getDay()]}) · 예약 ${bookings.length}건`}
        actions={
          <button
            onClick={openNewBooking}
            disabled={resFiltered.length === 0}
            className={cn(
              "flex h-9.5 items-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-semibold transition-colors",
              resFiltered.length === 0
                ? "cursor-not-allowed bg-[#f1f5f9] text-[#cbd5e1]"
                : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
            )}
          >
            <Plus className="size-4" />
            새 예약
          </button>
        }
      />

      {/* 필터 바 */}
      <GwCard className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="w-16 shrink-0 text-[11.5px] font-semibold text-muted-foreground">
            자원 종류
          </span>
          <div className="flex flex-wrap gap-1.5">
            {RES_TYPES.map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  setResType(t.label);
                  setResCap("전체");
                  clearSelection();
                }}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                  resType === t.label
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-secondary-foreground hover:bg-secondary",
                )}
              >
                <ResIcon name={t.icon} className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-[#f1f5f9] pt-3">
          <span className="w-16 shrink-0 text-[11.5px] font-semibold text-muted-foreground">
            수용 인원
          </span>
          <div className="flex flex-wrap gap-1.5">
            {RES_CAP_FILTERS.map((c) => (
              <button
                key={c}
                onClick={() => setResCap(c)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
                  resCap === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-secondary-foreground hover:bg-secondary",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-[#f1f5f9] pt-3">
          <span className="w-16 shrink-0 text-[11.5px] font-semibold text-muted-foreground">
            필수 장비
          </span>
          <div className="flex flex-wrap gap-2">
            {RES_EQUIP_FILTERS.map((e) => {
              const on = !!resEquip[e];
              return (
                <button
                  key={e}
                  onClick={() => {
                    setResEquip((prev) => ({ ...prev, [e]: !prev[e] }));
                    clearSelection();
                  }}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                    on
                      ? "border-[#c7d2fe] bg-[#f5f6ff] text-secondary-foreground"
                      : "border-border bg-card text-secondary-foreground hover:bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded",
                      on ? "bg-primary" : "border-[1.5px] border-[#cbd5e1] bg-card",
                    )}
                  >
                    {on && <Check className="size-2.5 text-white" strokeWidth={3} />}
                  </span>
                  {e}
                </button>
              );
            })}
          </div>
          <span className="ml-auto text-[11.5px] text-muted-foreground">
            {resFiltered.length}개 자원 · 조건 일치
          </span>
        </div>
      </GwCard>

      {/* 타임 그리드 */}
      <GwCard>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#eef1f5] px-4 py-3">
          <span className="text-[12.5px] font-semibold">타임라인</span>
          <span className="text-[11.5px] text-muted-foreground">
            08:00 – 20:00 · 30분 단위
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-3.5">
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="size-3 rounded bg-primary" />
              예약됨
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="size-3 rounded border border-[#a7f3d0] bg-[#ecfdf5]" />
              예약 가능
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="size-3 rounded bg-[#10b981]" />
              선택 구간
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            className="min-w-[1020px] select-none pb-3.5"
          >
            <div className="flex items-end border-b border-[#eef1f5] px-4 pb-2 pt-2.5">
              <div className="w-[168px] shrink-0 text-[11.5px] font-semibold text-muted-foreground">
                자원
              </div>
              <div className="flex flex-1">
                {Array.from({ length: 13 }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-[10.5px] text-muted-foreground tabular-nums",
                      i === 12 ? "w-0 flex-none" : "flex-1 border-l border-[#eef1f5] pl-[3px]",
                    )}
                  >
                    {String(8 + i).padStart(2, "0")}
                  </div>
                ))}
              </div>
            </div>

            {resFiltered.map((r) => {
              const blocks = bookings
                .map((b, bi) => ({ ...b, bi }))
                .filter((b) => b.res === r.key);
              const showSel = hasSel && selRes === r.key;
              return (
                <div
                  key={r.key}
                  className="flex items-stretch border-b border-[#f1f5f9] px-4"
                >
                  <div className="flex w-[168px] shrink-0 flex-col justify-center gap-1 py-3 pr-3">
                    <div className="flex items-center gap-1.5">
                      <ResIcon name={r.icon} className="size-[15px] text-muted-foreground" />
                      <span className="text-[12.5px] font-semibold">{r.name}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{r.meta}</div>
                    <div className="flex flex-wrap gap-1">
                      {r.equip.map((eq) => (
                        <span
                          key={eq}
                          className="rounded bg-secondary px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground"
                        >
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="relative flex-1 py-2.5">
                    <div className="absolute inset-y-2.5 inset-x-0 flex">
                      {Array.from({ length: BOOKING_SLOTS }, (_, i) => {
                        const booked = bookedIn(r.key, i);
                        return (
                          <div
                            key={i}
                            onMouseDown={() => handleMouseDown(r.key, i, booked)}
                            onMouseEnter={() => handleMouseEnter(r.key, i, booked)}
                            onClick={() => handleClick(r.key, i, booked)}
                            className={cn(
                              "flex-1 border-l",
                              i % 2 === 0 ? "border-[#eef1f5]" : "border-[#f8fafc]",
                              booked ? "cursor-default" : "cursor-pointer",
                            )}
                          />
                        );
                      })}
                    </div>

                    <div className="relative h-[46px]">
                      {blocks.map((b) => (
                        <button
                          key={b.bi}
                          onClick={() => setViewBooking(b)}
                          style={{
                            left: `${(b.from / BOOKING_SLOTS) * 100}%`,
                            width: `${((b.to - b.from) / BOOKING_SLOTS) * 100}%`,
                          }}
                          className="absolute top-0 flex h-[46px] items-center gap-1.5 overflow-hidden rounded-lg bg-primary px-2 shadow-[0_2px_6px_rgba(79,70,229,0.28)]"
                        >
                          <span
                            style={{
                              ...avatarStyle(b.who.charAt(0), 22),
                              border: "1.5px solid rgba(255,255,255,.45)",
                            }}
                          >
                            {b.who.charAt(0)}
                          </span>
                          <span className="flex min-w-0 flex-col items-start">
                            <span className="truncate text-[11px] font-semibold text-white">
                              {b.title}
                            </span>
                            <span className="truncate text-[10px] text-white/75">
                              {slotLabel(b.from)} – {slotLabel(b.to)}
                            </span>
                          </span>
                        </button>
                      ))}
                      {showSel && (
                        <div
                          style={{
                            left: `${((selStart as number) / BOOKING_SLOTS) * 100}%`,
                            width: `${(((selEnd as number) - (selStart as number)) / BOOKING_SLOTS) * 100}%`,
                          }}
                          className="pointer-events-none absolute top-0 flex h-[46px] items-center justify-center rounded-lg bg-[#10b981] shadow-[0_2px_8px_rgba(16,185,129,0.35)]"
                        >
                          <span className="text-[11px] font-bold text-white">
                            {selRangeLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {resFiltered.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-11">
                <Search className="size-6 text-muted-foreground" />
                <div className="text-[13px] font-semibold text-secondary-foreground">
                  조건에 맞는 자원이 없습니다
                </div>
                <div className="text-xs text-muted-foreground">
                  수용 인원이나 필수 장비 조건을 완화해 보세요
                </div>
                <button
                  onClick={() => {
                    setResCap("전체");
                    setResEquip({});
                    clearSelection();
                  }}
                  className="mt-1 h-8 rounded-[9px] border border-border bg-card px-3.5 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
                >
                  필터 초기화
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-[#eef1f5] bg-secondary px-4 py-3">
          <span className="text-[11.5px] text-muted-foreground">
            {hasSel
              ? `${selResObj?.name} · ${selRangeLabel} (${((selEnd as number) - (selStart as number)) * 30}분) 선택됨`
              : "빈 슬롯을 드래그하거나, 시작 슬롯을 클릭한 뒤 종료 슬롯을 클릭해 구간을 지정하세요"}
          </span>
          {hasSel && (
            <div className="ml-auto flex gap-2">
              <button
                onClick={clearSelection}
                className="h-8.5 rounded-[9px] border border-border bg-card px-3.5 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
              >
                선택 해제
              </button>
              <button
                onClick={() => setBookOpen(true)}
                className="flex h-8.5 items-center gap-1.5 rounded-[9px] bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
              >
                <Plus className="size-3.5" />
                {selResObj?.name} {selRangeLabel} 예약하기
              </button>
            </div>
          )}
        </div>
      </GwCard>

      {/* 예약 모달 */}
      {bookOpen && (
        <div
          onClick={closeBook}
          className="fixed inset-0 z-[66] flex items-center justify-center bg-[rgba(15,23,42,.45)] p-6 backdrop-blur-[2px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-[500px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
              <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#eef2ff] text-primary">
                <Plus className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold tracking-[-0.015em]">예약하기</div>
                <div className="truncate text-xs text-muted-foreground">
                  {selResObj?.name ?? resFiltered[0]?.name ?? "회의실 A"} ·{" "}
                  {hasSel ? selRangeLabel : "10:00 – 11:00"}
                </div>
              </div>
              <button
                onClick={closeBook}
                className="flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">
              <div>
                <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                  회의 제목
                </div>
                <input
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="예: 플랫폼 주간 스프린트 회의"
                  className="h-[38px] w-full rounded-[9px] border border-border px-3 text-[13px] outline-none focus:border-primary focus:ring-[3px] focus:ring-[rgba(79,70,229,0.12)]"
                />
              </div>

              <div>
                <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                  사용 목적
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BOOK_PURPOSES.map((p) => (
                    <button
                      key={p}
                      onClick={() => setBookPurpose(p)}
                      className={cn(
                        "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                        bookPurpose === p
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-secondary-foreground hover:bg-secondary",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                  참석자 초대
                </div>
                <div className="flex flex-col gap-2 rounded-[10px] border border-border p-2">
                  <div className="flex flex-wrap gap-1.5">
                    {bookAtt.map((id) => {
                      const p = directory.find((x) => x.id === id);
                      if (!p) return null;
                      return (
                        <span
                          key={id}
                          className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-1.5"
                        >
                          <span style={avatarStyle(p.name.charAt(0), 20)}>
                            {p.name.charAt(0)}
                          </span>
                          <span className="text-[11.5px] font-semibold text-secondary-foreground">
                            {p.name}
                          </span>
                          <button
                            onClick={() =>
                              setBookAtt((prev) => prev.filter((x) => x !== id))
                            }
                            className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-[#e2e8f0] hover:text-secondary-foreground"
                          >
                            <X className="size-2.5" />
                          </button>
                        </span>
                      );
                    })}
                    <input
                      value={bookQuery}
                      onChange={(e) => setBookQuery(e.target.value)}
                      placeholder="이름 입력 (조직도 자동완성)"
                      className="h-7 min-w-[140px] flex-1 border-none bg-transparent text-[12.5px] outline-none"
                    />
                  </div>
                  {bookSuggest.length > 0 && (
                    <div className="flex flex-col gap-0.5 border-t border-[#f1f5f9] pt-1.5">
                      {bookSuggest.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setBookAtt((prev) => [...prev, p.id]);
                            setBookQuery("");
                          }}
                          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-secondary"
                        >
                          <span style={avatarStyle(p.name.charAt(0), 26)}>
                            {p.name.charAt(0)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-semibold">
                              {p.name}{" "}
                              <span className="font-normal text-muted-foreground">
                                {p.role}
                              </span>
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {p.dept}
                            </span>
                          </span>
                          <Plus className="size-3.5 text-primary" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[11px] border border-border p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#eef2ff]">
                  <Video className="size-4 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold">화상회의 링크 자동 생성</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {bookVideoOn
                      ? `${bookProvider} 링크가 초대장에 함께 발송됩니다`
                      : "링크 없이 오프라인 회의로 등록됩니다"}
                  </div>
                </div>
                <Toggle on={bookVideoOn} onClick={() => setBookVideoOn((v) => !v)} />
              </div>

              {bookVideoOn && (
                <div className="flex gap-1.5">
                  {BOOK_PROVIDERS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setBookProvider(p)}
                      className={cn(
                        "h-[34px] flex-1 rounded-[9px] border text-xs font-semibold transition-colors",
                        bookProvider === p
                          ? "border-primary bg-[#f5f6ff] text-[#4338ca]"
                          : "border-border bg-card text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#eef1f5] bg-secondary px-5 py-3.5">
              <button
                onClick={closeBook}
                className="h-10 flex-1 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-[#f1f5f9]"
              >
                취소
              </button>
              <button
                onClick={confirmBook}
                disabled={!hasSel || conflict || saving}
                className={cn(
                  "h-10 flex-[2] rounded-[10px] text-[13px] font-semibold transition-colors",
                  !hasSel || conflict || saving
                    ? "cursor-not-allowed bg-[#f1f5f9] text-muted-foreground"
                    : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
                )}
              >
                {conflict
                  ? "이미 예약된 시간입니다"
                  : saving
                    ? "예약하는 중…"
                    : "예약 확정"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 예약 상세 · 취소 모달 */}
      {viewBooking && (
        <div
          onClick={() => setViewBooking(null)}
          className="fixed inset-0 z-[66] flex items-center justify-center bg-[rgba(15,23,42,.45)] p-6 backdrop-blur-[2px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
              <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#eef2ff] text-primary">
                <ResIcon
                  name={RESOURCES.find((r) => r.key === viewBooking.res)?.icon ?? "DoorOpen"}
                  className="size-4"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold tracking-[-0.015em]">
                  예약 상세
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {RESOURCES.find((r) => r.key === viewBooking.res)?.name ?? viewBooking.res}
                </div>
              </div>
              <button
                onClick={() => setViewBooking(null)}
                className="flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span style={avatarStyle(viewBooking.who.charAt(0), 34)}>
                  {viewBooking.who.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">
                    {viewBooking.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {viewBooking.who} · {slotLabel(viewBooking.from)} –{" "}
                    {slotLabel(viewBooking.to)}
                  </div>
                </div>
              </div>
              {viewBooking.purpose && (
                <div className="text-[12.5px] text-secondary-foreground">
                  사용 목적: {viewBooking.purpose}
                </div>
              )}
              {viewBooking.video && (
                <div className="flex items-center gap-1.5 text-[12.5px] text-secondary-foreground">
                  <Video className="size-3.5 text-primary" />
                  {viewBooking.provider} 화상회의 링크 발송됨
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#eef1f5] bg-secondary px-5 py-3.5">
              <button
                onClick={() => setViewBooking(null)}
                className="h-10 flex-1 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-[#f1f5f9]"
              >
                닫기
              </button>
              {viewBooking.who === me.name && (
                <button
                  onClick={async () => {
                    if (cancelling) return;
                    setCancelling(true);
                    try {
                      await removeBooking(viewBooking.id);
                      setViewBooking(null);
                    } finally {
                      setCancelling(false);
                    }
                  }}
                  disabled={cancelling}
                  className="flex h-10 flex-[2] items-center justify-center gap-1.5 rounded-[10px] bg-[#e11d48] text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(225,29,72,0.35)] hover:bg-[#be123c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="size-4" />
                  {cancelling ? "취소하는 중…" : "예약 취소"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
