"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarClock,
  Loader2,
  Megaphone,
  Paperclip,
  Pin,
  PenSquare,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTICE_CATEGORIES, NOTICE_CAT_COLORS } from "@/lib/groupware/data";
import { pill } from "@/lib/groupware/ui";
import { useNotices } from "@/lib/groupware/hooks";
import { GwCard, PageHeader } from "@/components/app/primitives";

const PIN_ICONS: Record<string, React.ElementType> = {
  ShieldAlert,
  CalendarClock,
};

const COMPOSE_CATEGORIES = Object.keys(NOTICE_CAT_COLORS);

export default function NoticePage() {
  const [query, setQuery] = React.useState("");
  const [cat, setCat] = React.useState("전체");
  const [composeOpen, setComposeOpen] = React.useState(false);
  const { data, loading, addNotice } = useNotices();

  const pinned = data.filter((n) => n.pinned);
  const q = query.trim().toLowerCase();
  const rows = data
    .filter((n) => !n.pinned)
    .filter((n) => cat === "전체" || n.cat === cat)
    .filter(
      (n) =>
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.author.toLowerCase().includes(q),
    );

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4.5">
      <PageHeader
        title="사내 공지사항"
        desc={
          data.some((n) => n.unread)
            ? `전사 공지와 부서 공지를 확인하세요 · 미확인 ${data.filter((n) => n.unread).length}건`
            : "전사 공지와 부서 공지를 확인하세요"
        }
        actions={
          <>
            <div className="flex h-9 min-w-[240px] items-center gap-1.5 rounded-[9px] border border-border bg-card px-3">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="공지 제목 검색"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] focus-visible:outline-none"
              />
            </div>
            <button
              onClick={() => setComposeOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
            >
              <PenSquare className="size-4" />
              공지 작성
            </button>
          </>
        }
      />

      {pinned.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <Megaphone className="size-[15px] text-[#dc2626]" />
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-[#b91c1c]">
              필독 공지
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              상단 고정 {pinned.length}건
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
            {pinned.map((p) => {
              const Icon = PIN_ICONS[p.icon ?? "ShieldAlert"] ?? ShieldAlert;
              const accent = p.accent ?? "#dc2626";
              const chip = p.chip ?? ["#fee2e2", "#b91c1c"];
              return (
                <Link
                  href={`/notice/${p.id}`}
                  key={p.id}
                  className="block cursor-pointer rounded-[13px] border p-4.5 transition-all hover:-translate-y-px"
                  style={{
                    background: p.bg ?? "#fef2f2",
                    borderColor: p.border ?? "#fecaca",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-[30px] items-center justify-center rounded-lg border bg-card"
                      style={{ borderColor: p.border ?? "#fecaca" }}
                    >
                      <Icon className="size-4" style={{ color: accent }} />
                    </span>
                    <span style={pill(chip[0], chip[1])}>{p.cat}</span>
                    <Pin className="ml-auto size-3.5" style={{ color: accent }} />
                  </div>
                  <div
                    className="mt-3 text-[14.5px] font-semibold leading-snug tracking-[-0.015em]"
                    style={{ color: p.titleColor ?? "#7f1d1d" }}
                  >
                    {p.title}
                  </div>
                  {p.body && (
                    <div className="mt-1.5 text-[12.5px] leading-[1.6] text-secondary-foreground">
                      {p.body}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <span>{p.author}</span>
                    <span>·</span>
                    <span>{p.date}</span>
                    <span>·</span>
                    <span>조회 {p.views}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <GwCard>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#eef1f5] px-4 py-3">
          {NOTICE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                cat === c
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-secondary-foreground hover:bg-secondary",
              )}
            >
              {c}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            {loading && <Loader2 className="size-3 animate-spin" />}
            전체 {rows.length}건
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-[760px] border-b border-[#eef1f5] bg-secondary px-4.5 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
            <div className="w-[84px] shrink-0">카테고리</div>
            <div className="min-w-[220px] flex-1">제목</div>
            <div className="w-[104px] shrink-0">작성자</div>
            <div className="w-[84px] shrink-0">작성일</div>
            <div className="w-[70px] shrink-0 text-right">조회수</div>
          </div>
          {rows.map((n) => {
            const c = NOTICE_CAT_COLORS[n.cat] ?? ["#f1f5f9", "#475569"];
            return (
              <Link
                href={`/notice/${n.id}`}
                key={n.id}
                className="flex min-w-[760px] cursor-pointer items-center border-b border-[#f1f5f9] px-4.5 py-3 text-[12.5px] transition-colors hover:bg-secondary"
              >
                <div className="w-[84px] shrink-0">
                  <span style={pill(c[0], c[1])}>{n.cat}</span>
                </div>
                <div className="flex min-w-[220px] flex-1 items-center gap-1.5 pr-3.5">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: n.unread ? "#e11d48" : "transparent" }}
                  />
                  <span
                    className={cn(
                      "flex-1 truncate",
                      n.unread
                        ? "font-semibold text-foreground"
                        : "text-secondary-foreground",
                    )}
                  >
                    {n.title}
                  </span>
                  {n.attach && (
                    <Paperclip className="size-3 text-muted-foreground" />
                  )}
                </div>
                <div className="w-[104px] shrink-0 truncate text-secondary-foreground">
                  {n.author}
                </div>
                <div className="w-[84px] shrink-0 tabular-nums text-muted-foreground">
                  {n.date}
                </div>
                <div className="w-[70px] shrink-0 text-right tabular-nums text-muted-foreground">
                  {n.views}
                </div>
              </Link>
            );
          })}
        </div>
      </GwCard>

      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onSubmit={async (input) => {
            await addNotice(input);
            setComposeOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ComposeModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    cat: string;
    title: string;
    body: string;
    pinned: boolean;
  }) => Promise<void>;
}) {
  const [cat, setCat] = React.useState(COMPOSE_CATEGORIES[0] ?? "경영");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pinned, setPinned] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const valid = title.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    await onSubmit({ cat, title: title.trim(), body: body.trim(), pinned });
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#eef2ff] text-primary">
            <PenSquare className="size-4" />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.015em]">
              공지 작성
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              등록하면 바로 공지사항 목록에 게시됩니다
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4"
        >
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                카테고리
              </div>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className={composeInput}
              >
                {COMPOSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                제목<span className="ml-0.5 text-[#e11d48]">*</span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 2분기 경영실적 공유 안내"
                className={composeInput}
                required
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
              본문
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="공지 내용을 입력하세요"
              className={cn(composeInput, "h-auto resize-none py-2")}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-border p-3 text-[12.5px]">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="flex-1">
              <span className="font-semibold">필독 공지로 상단 고정</span>
              <span className="ml-1.5 text-muted-foreground">
                목록 상단의 필독 공지 카드로 표시됩니다
              </span>
            </span>
          </label>
        </form>

        <div className="flex gap-2 border-t border-[#eef1f5] bg-secondary px-5 py-3.5">
          <button
            onClick={onClose}
            className="h-10 flex-1 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-[#f1f5f9]"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={!valid || saving}
            className={cn(
              "h-10 flex-[2] rounded-[10px] text-[13px] font-semibold transition-colors",
              !valid || saving
                ? "cursor-not-allowed bg-[#f1f5f9] text-muted-foreground"
                : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
            )}
          >
            {saving ? "게시하는 중…" : "공지 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

const composeInput =
  "h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";
