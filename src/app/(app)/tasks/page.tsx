"use client";

import * as React from "react";
import {
  CheckSquare,
  Clock,
  GanttChart,
  GripVertical,
  List,
  ListChecks,
  Plus,
  Search,
  SquareKanban,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TAG_COLORS } from "@/lib/groupware/data";
import { TASK_COLUMNS, TASK_TAGS, type TaskDoc } from "@/lib/groupware/firestore";
import {
  useCurrentUser,
  useOrgPeople,
  useTasks,
  useTeams,
  type TaskInput,
} from "@/lib/groupware/hooks";
import { avatarStyle, ddayStyle } from "@/lib/groupware/ui";
import { GwCard, PageHeader, Segmented, Tag } from "@/components/app/primitives";
import { EmptyState } from "@/components/app/EmptyState";
import { ROOT_FILTER } from "@/lib/groupware/org-tree";

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

const emptyInput = (colKey: string): TaskInput => ({
  colKey,
  tag: TASK_TAGS[0],
  title: "",
  desc: "",
  who: "",
  assigneeId: null,
  teamId: null,
  startDate: "",
  dueDate: "",
  time: "",
});

const taskToInput = (t: TaskDoc): TaskInput => ({
  colKey: t.colKey,
  tag: t.tag,
  title: t.title,
  desc: t.desc ?? "",
  who: t.who,
  assigneeId: t.assigneeId ?? null,
  teamId: t.teamId ?? null,
  startDate: t.startDate ?? "",
  dueDate: t.dueDate ?? "",
  time: t.time ?? "",
});

export default function TasksPage() {
  const [view, setView] = React.useState<View>("kanban");
  const [query, setQuery] = React.useState("");
  // null = 아직 직접 고르지 않음 → 내 팀을 기본값으로 사용
  const [teamFilter, setTeamFilter] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<
    { mode: "new"; colKey: string } | { mode: "edit"; task: TaskDoc } | null
  >(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);
  const { data: tasks, addTask, saveTask, removeTask, moveTask, moveTaskTo, source } =
    useTasks();
  const { teams } = useTeams();
  const me = useCurrentUser();
  const activeTeamFilter = teamFilter ?? me.teamId ?? ROOT_FILTER;

  const q = query.trim().toLowerCase();
  const match = (t: TaskDoc) =>
    (!q ||
      t.title.toLowerCase().includes(q) ||
      t.who.toLowerCase().includes(q)) &&
    (activeTeamFilter === ROOT_FILTER || t.teamId === activeTeamFilter);

  const columns = TASK_COLUMNS.map((c) => ({
    ...c,
    items: tasks
      .filter((t) => t.colKey === c.key && match(t))
      .sort((a, b) => a.order - b.order),
  }));

  const flat = columns.flatMap((c) =>
    c.items.map((t) => ({ ...t, col: c.name, color: c.color })),
  );
  const members = Array.from(new Set(tasks.map((t) => t.who).filter(Boolean))).slice(
    0,
    6,
  );

  const handleDrop = (colKey: string, beforeId: string | null) => {
    if (dragId) moveTaskTo(dragId, colKey, beforeId);
    setDragId(null);
    setDragOverCol(null);
  };

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
      <PageHeader
        title="프로젝트 / Task"
        desc={
          tasks.length
            ? `Task ${tasks.length}건`
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
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTeamFilter(ROOT_FILTER)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTeamFilter === ROOT_FILTER
                ? "border-primary bg-primary text-white"
                : "border-border bg-card text-secondary-foreground hover:bg-secondary",
            )}
          >
            전체
          </button>
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setTeamFilter(t.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                activeTeamFilter === t.id
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-secondary-foreground hover:bg-secondary",
              )}
            >
              {t.name}
            </button>
          ))}
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
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col.key);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col.key, null);
              }}
              className={cn(
                "flex min-w-[250px] flex-1 flex-col gap-2.5 rounded-[13px] bg-[#f1f5f9] p-2.5 transition-colors",
                dragOverCol === col.key && dragId && "bg-[#e0e7ff]",
              )}
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

              {col.items.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    setDragId(t.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverCol(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverCol(col.key);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragId && dragId !== t.id) handleDrop(col.key, t.id);
                    else {
                      setDragId(null);
                      setDragOverCol(null);
                    }
                  }}
                  onClick={() => setModal({ mode: "edit", task: t })}
                  title="클릭하면 상세/수정, 드래그하면 이동합니다"
                  className={cn(
                    "group flex cursor-grab flex-col gap-2.5 rounded-[11px] border border-border bg-card p-3 text-left transition-all hover:-translate-y-px hover:border-[#cbd5e1] hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] active:cursor-grabbing",
                    dragId === t.id && "opacity-40",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <GripVertical className="size-3.5 shrink-0 text-[#cbd5e1] opacity-0 transition-opacity group-hover:opacity-100" />
                    <Tag label={t.tag} />
                    <Clock className="ml-auto size-[11px] text-muted-foreground" />
                    <span style={ddayStyle(t.dday)}>{t.dday}</span>
                  </div>
                  <div className="text-[13px] font-medium leading-snug tracking-[-0.01em]">
                    {t.title}
                  </div>
                  {t.desc && (
                    <p className="line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
                      {t.desc}
                    </p>
                  )}
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
                </div>
              ))}

              <button
                onClick={() => setModal({ mode: "new", colKey: col.key })}
                className="flex w-full items-center gap-1.5 rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[#e2e8f0] hover:text-foreground"
              >
                <Plus className="size-3.5" />새 Task 추가
              </button>
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
              onClick={() => setModal({ mode: "edit", task: t })}
              className="flex min-w-[800px] cursor-pointer items-center border-b border-[#f1f5f9] px-4.5 py-3 text-[12.5px] transition-colors hover:bg-secondary"
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

      {modal && (
        <TaskModal
          key={modal.mode === "edit" ? modal.task.id : `new-${modal.colKey}`}
          initial={modal.mode === "edit" ? taskToInput(modal.task) : emptyInput(modal.colKey)}
          isNew={modal.mode === "new"}
          onClose={() => setModal(null)}
          onSave={async (input) => {
            if (modal.mode === "edit") await saveTask(modal.task.id, input);
            else await addTask(input);
            setModal(null);
          }}
          onDelete={
            modal.mode === "edit"
              ? async () => {
                  await removeTask(modal.task.id);
                  setModal(null);
                }
              : undefined
          }
          onAdvance={
            modal.mode === "edit"
              ? async () => {
                  await moveTask(modal.task);
                  setModal(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function TaskModal({
  initial,
  isNew,
  onClose,
  onSave,
  onDelete,
  onAdvance,
}: {
  initial: TaskInput;
  isNew: boolean;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onAdvance?: () => Promise<void>;
}) {
  const { people } = useOrgPeople();
  const [title, setTitle] = React.useState(initial.title);
  const [tag, setTag] = React.useState(initial.tag);
  const [desc, setDesc] = React.useState(initial.desc);
  const [who, setWho] = React.useState(initial.who);
  const [assigneeId, setAssigneeId] = React.useState(initial.assigneeId);
  const [assigneeTeamId, setAssigneeTeamId] = React.useState(initial.teamId);
  const [assigneeOpen, setAssigneeOpen] = React.useState(false);
  const [startDate, setStartDate] = React.useState(initial.startDate);
  const [dueDate, setDueDate] = React.useState(initial.dueDate);
  const [time, setTime] = React.useState(initial.time);
  const [busy, setBusy] = React.useState(false);

  const assigneeQ = who.trim().toLowerCase();
  const assigneeMatches = assigneeQ
    ? people
        .filter(
          (p) =>
            p.name.toLowerCase().includes(assigneeQ) ||
            p.role.toLowerCase().includes(assigneeQ) ||
            p.dept.toLowerCase().includes(assigneeQ),
        )
        .slice(0, 6)
    : [];

  const pickAssignee = (p: (typeof people)[number]) => {
    setWho(p.name);
    setAssigneeId(p.id);
    setAssigneeTeamId(p.teamId);
    setAssigneeOpen(false);
  };

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({
        colKey: initial.colKey,
        title,
        tag,
        desc,
        who,
        assigneeId,
        teamId: assigneeTeamId,
        startDate,
        dueDate: dueDate && startDate && dueDate < startDate ? startDate : dueDate,
        time,
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
        className="animate-step flex w-full max-w-[460px] flex-col gap-4 rounded-[14px] border border-border bg-card p-5 shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold tracking-[-0.02em]">
            {isNew ? "새 Task 추가" : "Task 수정"}
          </span>
          <button
            onClick={onClose}
            className="ml-auto flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task 제목"
          className={cn(field, "font-medium")}
        />

        <div className="flex flex-wrap gap-1.5">
          {TASK_TAGS.map((key) => {
            const c = TAG_COLORS[key] ?? ["#f1f5f9", "#475569"];
            const active = tag === key;
            return (
              <button
                key={key}
                onClick={() => setTag(key)}
                className={cn(
                  "h-7 rounded-[7px] border px-2.5 text-[12px] font-semibold transition-colors",
                  active
                    ? ""
                    : "border-border bg-card text-secondary-foreground hover:bg-secondary",
                )}
                style={active ? { background: c[0], borderColor: c[1], color: c[1] } : undefined}
              >
                {key}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="relative flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
            담당자
            <input
              value={who}
              onChange={(e) => {
                setWho(e.target.value);
                setAssigneeId(null);
                setAssigneeTeamId(null);
                setAssigneeOpen(true);
              }}
              onFocus={() => setAssigneeOpen(true)}
              onBlur={() => setTimeout(() => setAssigneeOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && assigneeMatches[0]) {
                  e.preventDefault();
                  pickAssignee(assigneeMatches[0]);
                }
              }}
              placeholder="담당자 이름으로 검색"
              className={field}
            />
            {assigneeOpen && assigneeQ && assigneeMatches.length > 0 && (
              <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-[8px] border border-border bg-card shadow-[var(--shadow-pop)]">
                {assigneeMatches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickAssignee(p)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-normal hover:bg-secondary"
                  >
                    <span style={avatarStyle(p.name.charAt(0), 22)}>
                      {p.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-foreground">
                        {p.name} {p.role}
                      </span>
                      <span className="block truncate text-[10.5px] text-muted-foreground">
                        {p.dept}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
            마감 시각
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
            시작일
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
            종료일(마감)
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={field}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
          상세 내용
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="Task에 대한 상세 설명 (선택)"
            className="w-full resize-none rounded-[8px] border border-border bg-card px-2.5 py-2 text-[13px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

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
          {onAdvance && (
            <button
              onClick={onAdvance}
              className="h-9 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
            >
              다음 단계로
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
      </div>
    </div>
  );
}
