"use client";

import * as React from "react";
import Link from "next/link";
import {
  BellOff,
  CalendarClock,
  FileClock,
  Loader2,
  Megaphone,
  MessageSquare,
  Paperclip,
  Pin,
  PenSquare,
  Search,
  SearchX,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTICE_CATEGORIES, NOTICE_CAT_COLORS } from "@/lib/groupware/data";
import { pill } from "@/lib/groupware/ui";
import { useCurrentUser, useNotices } from "@/lib/groupware/hooks";
import type { NoticeDoc } from "@/lib/groupware/firestore";
import { GwCard, PageHeader } from "@/components/app/primitives";
import { EmptyState } from "@/components/app/EmptyState";
import { COMPOSE_CATEGORIES, ComposeModal, type ComposeState } from "./ComposeModal";

const PIN_ICONS: Record<string, React.ElementType> = {
  ShieldAlert,
  CalendarClock,
};

export default function NoticePage() {
  const me = useCurrentUser();
  const [query, setQuery] = React.useState("");
  const [cat, setCat] = React.useState("전체");
  const [showDrafts, setShowDrafts] = React.useState(false);
  const [composeState, setComposeState] = React.useState<ComposeState | null>(null);
  const { data, loading, addNotice, updateNotice } = useNotices();

  const published = data.filter((n) => n.status !== "draft");
  const myDrafts = data.filter((n) => n.status === "draft" && n.authorUid === me.uid);
  const pinned = published.filter((n) => n.pinned);
  const q = query.trim().toLowerCase();
  const rows = published
    .filter((n) => !n.pinned)
    .filter((n) => cat === "전체" || n.cat === cat)
    .filter(
      (n) =>
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.author.toLowerCase().includes(q),
    );

  const openEditor = (n: NoticeDoc) =>
    setComposeState({
      id: n.id,
      cat: n.cat,
      title: n.title,
      body: n.body ?? "",
      pinned: n.pinned,
    });

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
              onClick={() => setShowDrafts((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[12.5px] font-semibold transition-colors",
                showDrafts
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-secondary-foreground hover:bg-secondary",
              )}
            >
              <FileClock className="size-3.5" />
              임시저장함
              {myDrafts.length > 0 && (
                <span
                  className={cn(
                    "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    showDrafts ? "bg-white/25 text-white" : "bg-[#eef2ff] text-primary",
                  )}
                >
                  {myDrafts.length}
                </span>
              )}
            </button>
            <button
              onClick={() =>
                setComposeState({
                  cat: COMPOSE_CATEGORIES[0] ?? "경영",
                  title: "",
                  body: "",
                  pinned: false,
                })
              }
              className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
            >
              <PenSquare className="size-4" />
              공지 작성
            </button>
          </>
        }
      />

      {!showDrafts && pinned.length > 0 && (
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
        {showDrafts ? (
          <div className="flex items-center gap-1.5 border-b border-[#eef1f5] px-4 py-3">
            <FileClock className="size-4 text-primary" />
            <span className="text-[13px] font-semibold">임시저장함</span>
            <span className="ml-auto text-[11.5px] text-muted-foreground">
              나만 볼 수 있음 · {myDrafts.length}건
            </span>
          </div>
        ) : (
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
        )}

        {showDrafts ? (
          myDrafts.length === 0 ? (
            <EmptyState
              className="rounded-none border-0 shadow-none"
              icon={<FileClock className="size-[26px]" />}
              title="임시저장된 공지가 없습니다"
              desc="작성 중인 공지를 임시저장하면 여기서 이어서 편집하거나 게시할 수 있습니다."
            />
          ) : (
            <div className="overflow-x-auto">
              <div className="flex min-w-[760px] border-b border-[#eef1f5] bg-secondary px-4.5 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
                <div className="w-[84px] shrink-0">카테고리</div>
                <div className="min-w-[220px] flex-1">제목</div>
                <div className="w-[104px] shrink-0">작성자</div>
                <div className="w-[84px] shrink-0">저장일</div>
              </div>
              {myDrafts.map((n) => {
                const c = NOTICE_CAT_COLORS[n.cat] ?? ["#f1f5f9", "#475569"];
                return (
                  <button
                    type="button"
                    key={n.id}
                    onClick={() => openEditor(n)}
                    className="flex w-full min-w-[760px] items-center border-b border-[#f1f5f9] px-4.5 py-3 text-left text-[12.5px] transition-colors hover:bg-secondary"
                  >
                    <div className="w-[84px] shrink-0">
                      <span style={pill(c[0], c[1])}>{n.cat}</span>
                    </div>
                    <div className="flex min-w-[220px] flex-1 items-center gap-1.5 pr-3.5">
                      <span className="flex-1 truncate text-secondary-foreground">
                        {n.title || "(제목 없음)"}
                      </span>
                    </div>
                    <div className="w-[104px] shrink-0 truncate text-secondary-foreground">
                      {n.author}
                    </div>
                    <div className="w-[84px] shrink-0 tabular-nums text-muted-foreground">
                      {n.date}
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : !loading && rows.length === 0 ? (
          <EmptyState
            className="rounded-none border-0 shadow-none"
            tint={
              q || cat !== "전체" ? ["#f1f5f9", "#64748b"] : ["#fff7ed", "#c2410c"]
            }
            icon={
              q || cat !== "전체" ? (
                <SearchX className="size-[26px]" />
              ) : (
                <BellOff className="size-[26px]" />
              )
            }
            title={
              q || cat !== "전체" ? "검색 결과가 없습니다" : "등록된 공지가 없습니다"
            }
            desc={
              q || cat !== "전체"
                ? "검색어나 카테고리 필터를 완화해 보세요."
                : "첫 공지를 작성하면 전사 구성원에게 바로 게시됩니다."
            }
            cta={
              q || cat !== "전체"
                ? undefined
                : {
                    label: "공지 작성",
                    icon: <PenSquare className="size-4" />,
                    onClick: () =>
                      setComposeState({
                        cat: COMPOSE_CATEGORIES[0] ?? "경영",
                        title: "",
                        body: "",
                        pinned: false,
                      }),
                  }
            }
          />
        ) : (
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
                  {!!n.comments && (
                    <span className="flex items-center gap-0.5 text-[11px] font-semibold text-primary">
                      <MessageSquare className="size-3" />
                      {n.comments}
                    </span>
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
        )}
      </GwCard>

      {composeState && (
        <ComposeModal
          initial={composeState}
          onClose={() => setComposeState(null)}
          onSubmit={async (input, draft) => {
            if (composeState.id) {
              await updateNotice(composeState.id, input, draft);
            } else {
              await addNotice(input, draft);
            }
            setComposeState(null);
          }}
        />
      )}
    </div>
  );
}

