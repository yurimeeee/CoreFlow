"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  FilePlus2,
  FileCheck2,
  Megaphone,
  Menu,
  Palmtree,
  Plus,
  Search,
  SquarePlus,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTIFS, NOTIF_CAT_COLORS } from "@/lib/groupware/data";
import { pill } from "@/lib/groupware/ui";
import { CommandPalette } from "./CommandPalette";
import { screenTitle } from "./nav";

const NOTIF_ICONS: Record<string, React.ElementType> = {
  FileCheck2,
  CircleX,
  Clock,
  Megaphone,
  Timer,
  CircleCheck,
  CalendarClock,
};

const NOTIF_TABS = ["전체", "결재", "근태", "공지"];

export function AppHeader({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [tab, setTab] = React.useState("전체");
  const [read, setRead] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = NOTIFS.filter((n) => tab === "전체" || n.cat === tab);
  const unread = NOTIFS.filter((n) => !read[n.id]).length;

  const quickActions = [
    { label: "기안 작성", key: "D", icon: FilePlus2, href: "/approval/new" },
    { label: "Task 추가", key: "T", icon: SquarePlus, href: "/tasks" },
    { label: "연차 신청", key: "V", icon: Palmtree, href: "/attendance" },
    { label: "공지 작성", key: "N", icon: Megaphone, href: "/notice" },
  ];

  return (
    <header className="relative z-20 flex h-15 shrink-0 items-center gap-4 border-b border-border bg-card/85 px-4 backdrop-blur sm:px-5.5">
      <button
        onClick={onMenu}
        className="rounded-md p-1.5 text-secondary-foreground hover:bg-secondary lg:hidden"
        aria-label="메뉴"
      >
        <Menu className="size-5" />
      </button>

      <div className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.015em]">
        {screenTitle(pathname)}
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex h-9 w-full max-w-[420px] items-center gap-2.5 rounded-[9px] border border-border bg-secondary px-2.5 text-left transition-colors hover:border-[#cbd5e1] hover:bg-card"
        >
          <Search className="size-[15px] text-muted-foreground" />
          <span className="flex-1 text-[13px] text-muted-foreground">
            문서, 구성원, 프로젝트 검색
          </span>
          <span className="flex gap-1">
            {["Ctrl", "K"].map((k) => (
              <kbd
                key={k}
                className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground"
              >
                {k}
              </kbd>
            ))}
          </span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen((v) => !v);
              setQuickOpen(false);
            }}
            className={cn(
              "relative flex size-9 items-center justify-center rounded-[9px] transition-colors",
              notifOpen
                ? "bg-accent text-accent-foreground"
                : "text-secondary-foreground hover:bg-secondary",
            )}
            aria-label="알림"
          >
            <Bell className="size-[18px]" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full border-2 border-card bg-destructive px-1 text-[9.5px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setNotifOpen(false)}
              />
              <div className="animate-step absolute right-0 top-11 z-20 flex max-h-[520px] w-[min(384px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-pop)]">
                <div className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
                  <span className="text-[13.5px] font-semibold tracking-[-0.015em]">
                    알림 센터
                  </span>
                  <span
                    style={pill(
                      unread ? "#fef2f2" : "#f1f5f9",
                      unread ? "#b91c1c" : "#94a3b8",
                    )}
                  >
                    {unread ? `미확인 ${unread}건` : "모두 확인"}
                  </span>
                  <button
                    onClick={() => {
                      const m: Record<string, boolean> = {};
                      NOTIFS.forEach((n) => (m[n.id] = true));
                      setRead(m);
                    }}
                    className="ml-auto flex items-center gap-1 rounded-[7px] px-1.5 py-1 text-[11.5px] font-semibold text-primary hover:bg-accent"
                  >
                    <CheckCheck className="size-3" />
                    모두 읽음
                  </button>
                </div>

                <div className="flex gap-1 px-3 pb-2.5">
                  {NOTIF_TABS.map((t) => {
                    const c = NOTIFS.filter(
                      (x) => (t === "전체" || x.cat === t) && !read[x.id],
                    ).length;
                    return (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                          "h-[30px] flex-1 rounded-lg text-[12px] font-semibold transition-colors",
                          tab === t
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {c ? `${t} ${c}` : t}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto border-t border-border">
                  {items.map((n) => {
                    const c = NOTIF_CAT_COLORS[n.cat];
                    const Icon = NOTIF_ICONS[n.icon] ?? Bell;
                    const isUnread = !read[n.id];
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          setRead((r) => ({ ...r, [n.id]: true }));
                          setNotifOpen(false);
                          router.push(n.to);
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 border-b border-border px-3.5 py-3 text-left transition-colors hover:bg-secondary/60",
                          isUnread && "bg-[#fbfbff]",
                        )}
                      >
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-[9px]"
                          style={{ background: c[0] }}
                        >
                          <Icon className="size-[15px]" style={{ color: c[2] }} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex items-center gap-1.5">
                            <span style={pill(c[0], c[1])}>{n.cat}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {n.time}
                            </span>
                            {isUnread && (
                              <span className="size-1.5 rounded-full bg-destructive" />
                            )}
                          </span>
                          <span
                            className={cn(
                              "text-[12.5px] tracking-[-0.01em]",
                              isUnread
                                ? "font-semibold text-foreground"
                                : "text-secondary-foreground",
                            )}
                          >
                            {n.title}
                          </span>
                          <span className="text-[11.5px] leading-relaxed text-muted-foreground">
                            {n.desc}
                          </span>
                        </span>
                        <ChevronRight className="size-3.5 shrink-0 self-center text-[#cbd5e1]" />
                      </button>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <BellOff className="size-6 text-[#cbd5e1]" />
                      <span className="text-[12.5px] text-muted-foreground">
                        해당 분류의 알림이 없습니다
                      </span>
                    </div>
                  )}
                </div>

                <Link
                  href="/notice"
                  onClick={() => setNotifOpen(false)}
                  className="border-t border-border bg-secondary py-2.5 text-center text-[12.5px] font-semibold text-secondary-foreground hover:bg-[#f1f5f9]"
                >
                  알림 전체 보기
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="h-[22px] w-px bg-border" />

        <div className="relative">
          <button
            onClick={() => {
              setQuickOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary pl-2.5 pr-3 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] transition-colors hover:bg-primary-hover"
          >
            <Plus className="size-[15px]" strokeWidth={2.2} />
            <span className="hidden sm:inline">빠른 생성</span>
          </button>

          {quickOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setQuickOpen(false)}
              />
              <div className="animate-step absolute right-0 top-11 z-20 w-[232px] rounded-xl border border-border bg-card p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
                {quickActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link
                      key={a.label}
                      href={a.href}
                      onClick={() => setQuickOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] transition-colors hover:bg-[#f1f5f9]"
                    >
                      <Icon className="size-4 text-primary" />
                      <span className="flex-1">{a.label}</span>
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {a.key}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} />
      )}
    </header>
  );
}
