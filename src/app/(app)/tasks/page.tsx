"use client";

import * as React from "react";
import {
  CheckSquare,
  Clock,
  GanttChart,
  List,
  ListChecks,
  Plus,
  Search,
  SquareKanban,
} from "lucide-react";
import { TASK_COLUMNS, type TaskDoc } from "@/lib/groupware/firestore";
import { useTasks } from "@/lib/groupware/hooks";
import { avatarStyle, ddayStyle } from "@/lib/groupware/ui";
import { GwCard, PageHeader, Segmented, Tag } from "@/components/app/primitives";
import { EmptyState } from "@/components/app/EmptyState";

type View = "kanban" | "list" | "gantt";

const GANTT_DAYS = 14;
/** 오늘을 간트 2일차에 맞추고, dday("D-7"/"D+2") 로 막대 위치를 계산 */
function ganttBar(dday: string, total: number) {
  const n = Number(dday.replace(/[^\-0-9]/g, "")) || 0;
  const due = Math.min(Math.max(2 + n, 1), GANTT_DAYS);
  const len = Math.min(Math.max(3 + total, 2), 7);
  const start = Math.min(Math.max(due - len, 0), GANTT_DAYS - 1);
  return { start, len: Math.min(len, GANTT_DAYS - start) };
}

export default function TasksPage() {
  const [view, setView] = React.useState<View>("kanban");
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const { data: tasks, addTask, moveTask, source } = useTasks();

  const q = query.trim().toLowerCase();
  const match = (t: TaskDoc) =>
    !q ||
    t.title.toLowerCase().includes(q) ||
    t.who.toLowerCase().includes(q);

  const columns = TASK_COLUMNS.map((c) => ({
    ...c,
    items: tasks
      .filter((t) => t.colKey === c.key)
      .sort((a, b) => a.order - b.order),
  }));

  const submit = async (colKey: string) => {
    const title = draft.trim();
    setAdding(null);
    setDraft("");
    if (title) await addTask(colKey, title);
  };

  const flat = columns.flatMap((c) =>
    c.items.filter(match).map((t) => ({ ...t, col: c.name, color: c.color })),
  );
  const members = Array.from(new Set(tasks.map((t) => t.who).filter(Boolean))).slice(
    0,
    6,
  );

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
      <PageHeader
        title="프로젝트 / Task"
        desc={
          tasks.length
            ? `${source === "firestore" ? "Firestore 연동" : "로컬"} · Task ${tasks.length}건`
            : "아직 등록된 Task가 없습니다"
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            {
              value: "kanban",
              label: "칸반 보드",
              icon: <SquareKanban className="size-3.5" />,
            },
            {
              value: "list",
              label: "리스트 뷰",
              icon: <List className="size-3.5" />,
            },
            {
              value: "gantt",
              label: "간트 차트",
              icon: <GanttChart className="size-3.5" />,
            },
          ]}
        />
        <div className="flex h-8.5 min-w-[200px] items-center gap-1.5 rounded-[9px] border border-border bg-card px-2.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="담당자 또는 Task 검색"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] focus-visible:outline-none"
          />
        </div>
        {members.length > 0 && (
          <div className="ml-auto flex items-center">
            {members.map((m, i) => (
              <span
                key={m}
                title={m}
                style={{
                  ...avatarStyle(m.charAt(0), 28),
                  border: "2px solid var(--color-background)",
                  marginLeft: i === 0 ? 0 : -8,
                }}
              >
                {m.charAt(0)}
              </span>
            ))}
          </div>
        )}
      </div>

      {view === "kanban" && (
        <div className="flex items-start gap-3.5 overflow-x-auto pb-1.5">
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex min-w-[250px] flex-1 flex-col gap-2.5 rounded-[13px] bg-[#f1f5f9] p-2.5"
            >
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <span
                  className="size-[7px] rounded-full"
                  style={{ background: col.color }}
                />
                <span className="text-[12.5px] font-semibold text-secondary-foreground">
                  {col.name}
                </span>
                <span className="ml-auto text-[11.5px] tabular-nums text-muted-foreground">
                  {col.items.length}
                </span>
              </div>

              {col.items.filter(match).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => moveTask(t)}
                  title="클릭하면 다음 단계로 이동합니다"
                  className="flex cursor-pointer flex-col gap-2.5 rounded-[11px] border border-border bg-card p-3 text-left transition-all hover:-translate-y-px hover:border-[#cbd5e1] hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-center gap-1.5">
                    <Tag label={t.tag} />
                    <Clock className="ml-auto size-[11px] text-muted-foreground" />
                    <span style={ddayStyle(t.dday)}>{t.dday}</span>
                  </div>
                  <div className="text-[13px] font-medium leading-snug tracking-[-0.01em]">
                    {t.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={avatarStyle(t.who.charAt(0), 22)}>
                      {t.who.charAt(0)}
                    </span>
                    <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          background:
                            t.done === t.total ? "#16a34a" : "#4f46e5",
                          width: `${Math.round((t.done / t.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="flex items-center gap-1 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                      <CheckSquare className="size-[11px]" />
                      {t.done}/{t.total}
                    </span>
                  </div>
                </button>
              ))}

              {adding === col.key ? (
                <div className="rounded-[11px] border border-primary bg-card p-2.5 shadow-[0_0_0_3px_rgba(79,70,229,0.12)]">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit(col.key);
                      if (e.key === "Escape") {
                        setAdding(null);
                        setDraft("");
                      }
                    }}
                    placeholder="Task 제목 입력 후 Enter"
                    className="w-full bg-transparent text-[12.5px] focus-visible:outline-none"
                  />
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => submit(col.key)}
                      className="h-7 rounded-[7px] bg-primary px-2.5 text-xs font-semibold text-white"
                    >
                      추가
                    </button>
                    <button
                      onClick={() => {
                        setAdding(null);
                        setDraft("");
                      }}
                      className="h-7 rounded-[7px] border border-border bg-card px-2.5 text-xs text-muted-foreground"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAdding(col.key);
                    setDraft("");
                  }}
                  className="flex w-full items-center gap-1.5 rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[#e2e8f0] hover:text-foreground"
                >
                  <Plus className="size-3.5" />새 Task 추가
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "list" && (
        <GwCard className="overflow-x-auto">
          <div className="flex min-w-[800px] border-b border-[#eef1f5] bg-secondary px-4.5 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
            <div className="w-24 shrink-0">상태</div>
            <div className="w-[90px] shrink-0">태그</div>
            <div className="min-w-[200px] flex-1">Task</div>
            <div className="w-24 shrink-0">담당자</div>
            <div className="w-[110px] shrink-0">체크리스트</div>
            <div className="w-[86px] shrink-0 text-right">마감</div>
          </div>
          {flat.map((t) => (
            <div
              key={t.id}
              className="flex min-w-[800px] items-center border-b border-[#f1f5f9] px-4.5 py-3 text-[12.5px] transition-colors hover:bg-secondary"
            >
              <div className="flex w-24 shrink-0 items-center gap-1.5">
                <span
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ background: t.color }}
                />
                <span className="text-xs text-secondary-foreground">
                  {t.col}
                </span>
              </div>
              <div className="w-[90px] shrink-0">
                <Tag label={t.tag} />
              </div>
              <div className="min-w-[200px] flex-1 truncate pr-3.5 font-medium">
                {t.title}
              </div>
              <div className="flex w-24 shrink-0 items-center gap-1.5">
                <span style={avatarStyle(t.who.charAt(0), 20)}>
                  {t.who.charAt(0)}
                </span>
                <span className="text-xs text-secondary-foreground">
                  {t.who}
                </span>
              </div>
              <div className="flex w-[110px] shrink-0 items-center gap-1.5">
                <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: t.done === t.total ? "#16a34a" : "#4f46e5",
                      width: `${Math.round((t.done / t.total) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {t.done}/{t.total}
                </span>
              </div>
              <div className="flex w-[86px] shrink-0 justify-end">
                <span style={ddayStyle(t.dday)}>{t.dday}</span>
              </div>
            </div>
          ))}
          {flat.length === 0 && (
            <EmptyState
              className="rounded-none border-0 shadow-none"
              tint={["#f5f3ff", "#6d28d9"]}
              icon={<ListChecks className="size-[26px]" />}
              title={query ? "검색 결과가 없습니다" : "등록된 Task가 없습니다"}
              desc={
                query
                  ? "담당자나 제목 검색어를 바꿔 보세요."
                  : "칸반 보드에서 새 Task를 추가하면 목록에 표시됩니다."
              }
              cta={
                query
                  ? undefined
                  : {
                      label: "칸반 보드 열기",
                      icon: <SquareKanban className="size-4" />,
                      onClick: () => setView("kanban"),
                    }
              }
            />
          )}
        </GwCard>
      )}

      {view === "gantt" && (
        <GwCard className="overflow-x-auto p-4.5">
          <div className="min-w-[760px]">
            <div className="flex items-center border-b border-[#eef1f5] pb-2.5">
              <div className="w-[220px] shrink-0 text-[11.5px] font-semibold text-muted-foreground">
                Task
              </div>
              <div className="flex flex-1">
                {Array.from({ length: GANTT_DAYS }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 text-center text-[10.5px] tabular-nums"
                    style={{
                      color: i === 1 ? "#4f46e5" : "#94a3b8",
                      fontWeight: i === 1 ? 700 : 500,
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
            {flat.length === 0 && (
              <div className="py-10 text-center text-[12.5px] text-muted-foreground">
                표시할 Task가 없습니다
              </div>
            )}
            {flat.map((t) => {
              const bar = ganttBar(t.dday, t.total);
              return (
                <div
                  key={t.id}
                  className="flex items-center border-b border-[#f8fafc] py-2.5"
                >
                  <div className="flex w-[220px] shrink-0 items-center gap-1.5 pr-3.5">
                    <Tag label={t.tag} />
                    <span className="flex-1 truncate text-[12.5px] font-medium">
                      {t.title}
                    </span>
                  </div>
                  <div className="relative h-6 flex-1">
                    <div className="absolute inset-0 flex">
                      {Array.from({ length: GANTT_DAYS }, (_, i) => (
                        <div
                          key={i}
                          className="flex-1 border-l border-[#f8fafc]"
                        />
                      ))}
                    </div>
                    <div
                      className="absolute top-[3px] flex h-[18px] items-center rounded-md px-2 shadow-[0_1px_2px_rgba(15,23,42,0.12)]"
                      style={{
                        background: t.color,
                        left: `${(bar.start / GANTT_DAYS) * 100}%`,
                        width: `${(bar.len / GANTT_DAYS) * 100}%`,
                      }}
                    >
                      <span className="whitespace-nowrap text-[10.5px] font-semibold text-white">
                        {t.who}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GwCard>
      )}
    </div>
  );
}
