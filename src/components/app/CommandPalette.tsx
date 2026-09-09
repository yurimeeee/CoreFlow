"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FileCheck2,
  Megaphone,
  Search,
  SquareKanban,
  Users,
} from "lucide-react";
import {
  useApprovals,
  useEvents,
  useNotices,
  useOrgPeople,
  useTasks,
} from "@/lib/groupware/hooks";

type Hit = {
  icon: React.ElementType;
  group: string;
  title: string;
  sub: string;
  href: string;
};

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const { people } = useOrgPeople();
  const { data: notices } = useNotices();
  const { data: approvals } = useApprovals();
  const { data: tasks } = useTasks();
  const { data: events } = useEvents();

  const term = q.trim().toLowerCase();

  const hits: Hit[] = React.useMemo(() => {
    if (!term) return [];
    const has = (s: string) => s.toLowerCase().includes(term);
    const out: Hit[] = [];

    for (const p of people) {
      if (p.id === 0) continue;
      if (has(p.name + p.role + p.dept + (p.tags ?? []).join(" ")))
        out.push({
          icon: Users,
          group: "구성원",
          title: `${p.name} ${p.role}`,
          sub: p.dept,
          href: "/org",
        });
    }
    for (const n of notices) {
      if (has(n.title + n.author))
        out.push({
          icon: Megaphone,
          group: "공지",
          title: n.title,
          sub: `${n.author} · ${n.date}`,
          href: `/notice/${n.id}`,
        });
    }
    for (const a of approvals) {
      if (has(a.title + a.no + a.author))
        out.push({
          icon: FileCheck2,
          group: "전자결재",
          title: a.title,
          sub: `${a.no} · ${a.author}`,
          href: `/approval/${encodeURIComponent(a.no)}`,
        });
    }
    for (const t of tasks) {
      if (has(t.title + t.who))
        out.push({
          icon: SquareKanban,
          group: "Task",
          title: t.title,
          sub: `${t.who} · ${t.dday}`,
          href: "/tasks",
        });
    }
    for (const e of events) {
      if (has(e.title + e.location + e.ownerName))
        out.push({
          icon: CalendarDays,
          group: "일정",
          title: e.title,
          sub: `${e.date}${e.allDay ? " · 종일" : ` · ${e.start}`}`,
          href: "/calendar",
        });
    }
    return out.slice(0, 24);
  }, [term, people, notices, approvals, tasks, events]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-[#0f172a]/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && hits[0]) go(hits[0].href);
            }}
            placeholder="문서, 구성원, 프로젝트 검색"
            className="h-12 flex-1 bg-transparent text-[13.5px] focus-visible:outline-none"
          />
          <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5">
          {!term && (
            <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
              이름 · 공지 제목 · 문서번호 · Task 로 검색하세요
            </p>
          )}
          {term && hits.length === 0 && (
            <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
              &ldquo;{q}&rdquo; 검색 결과가 없습니다
            </p>
          )}
          {hits.map((h, i) => {
            const Icon = h.icon;
            return (
              <button
                key={`${h.href}-${i}`}
                onClick={() => go(h.href)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-secondary">
                  <Icon className="size-[15px] text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {h.title}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {h.sub}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {h.group}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
