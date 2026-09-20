"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  Mail,
  MessageSquare,
  Network,
  Pencil,
  Phone,
  Plus,
  Search,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  type Person,
  type PersonStatus,
} from "@/lib/groupware/data";
import {
  buildOrgStructure,
  personMatchesDeptFilter,
  ROOT_FILTER,
} from "@/lib/groupware/org-tree";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  useOrgPeople,
  useTeams,
  useWorkspace,
  type PersonInput,
} from "@/lib/groupware/hooks";
import { avatarStyle, pill, statusDot, statusPill } from "@/lib/groupware/ui";
import { GwCard, PageHeader, Segmented } from "@/components/app/primitives";
import { PositionSelect } from "@/components/app/PositionSelect";
import { EmptyState } from "@/components/app/EmptyState";

const STATUS_OPTIONS: { value: PersonStatus; label: string }[] = [
  { value: "online", label: "근무 중" },
  { value: "remote", label: "원격근무" },
  { value: "away", label: "회의 중" },
  { value: "leave", label: "연차" },
];

export default function OrgPage() {
  const [view, setView] = React.useState<"grid" | "tree">("grid");
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState(ROOT_FILTER);
  const [profileId, setProfileId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [assignTeamId, setAssignTeamId] = React.useState<string | null>(null);
  const {
    people: directory,
    source,
    addPerson,
    updatePerson,
    removePerson,
  } = useOrgPeople();
  const { teams, addTeam, updateTeam, removeTeam } = useTeams();
  const { data: workspace } = useWorkspace();
  const { profile } = useAuthUser();
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";

  const { deptTree, branches, filters } = React.useMemo(
    () =>
      buildOrgStructure(
        directory,
        teams,
        `${workspace.name || "전체 조직"} (대표이사)`,
      ),
    [directory, teams, workspace.name],
  );

  const byId = React.useCallback(
    (id: string) => directory.find((p) => p.id === id),
    [directory],
  );

  // 대표이사(최상위)는 boss===null 인 "그 한 사람"으로 판정. 가계정은 직속상사를
  // 아직 안 정했을 뿐이라 boss===null 이어도 CEO 후보에서 제외.
  const ceo = directory.find((p) => p.boss === null && !p.placeholder) ?? null;

  const q = query.trim().toLowerCase();
  const people = directory
    .filter((p) => p.id !== ceo?.id)
    .filter(
      (p) =>
        personMatchesDeptFilter(p, dept, teams) &&
        (!q ||
          (p.name + p.role + p.dept + (p.tags ?? []).join(" "))
            .toLowerCase()
            .includes(q)),
    );
  const ceoInitial = (ceo?.name || workspace.ceo || "대").charAt(0);
  const selected = profileId === null ? null : byId(profileId);
  const assignTeam = assignTeamId ? teams.find((t) => t.id === assignTeamId) : null;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
      <PageHeader
        title="조직도 · 임직원 디렉토리"
        desc={
          directory.length
            ? `${source === "firestore" ? "Firestore 연동" : "로컬"} · 재직 인원 ${directory.length}명`
            : "아직 등록된 구성원이 없습니다"
        }
        actions={
          <>
            <Link
              href="/admin/invite"
              className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-semibold text-secondary-foreground hover:bg-secondary"
            >
              <UserPlus className="size-4 text-primary" />
              멤버 초대
            </Link>
            <button
              onClick={() => setAddOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
            >
              <Plus className="size-4" />
              새 구성원 추가
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            {
              value: "tree",
              label: "트리 뷰",
              icon: <Network className="size-3.5" />,
            },
            {
              value: "grid",
              label: "그리드 뷰",
              icon: <LayoutGrid className="size-3.5" />,
            },
          ]}
        />
        <div className="flex h-8.5 max-w-[380px] flex-[1_1_260px] items-center gap-1.5 rounded-[9px] border border-border bg-card px-2.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름, 부서, 직급, 담당 업무 검색"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] focus-visible:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setDept(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                dept === f.key
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-secondary-foreground hover:bg-secondary",
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {people.length}명 표시 중
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <aside className="min-w-[240px] flex-[0_1_264px]">
          <GwCard className="p-3">
            <div className="px-2 pb-2 pt-1.5 text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
              부서 트리
            </div>
            {deptTree.map((d) => {
              const active = dept === d.key;
              const isTeam = d.depth > 0;
              return (
                <div
                  key={d.key}
                  className="group flex items-center gap-0.5"
                  style={{ paddingLeft: d.depth * 12 }}
                >
                  <button
                    onClick={() => setDept(d.key)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] tracking-[-0.01em] transition-colors",
                      active
                        ? "bg-accent font-semibold text-accent-foreground"
                        : "font-medium text-secondary-foreground hover:bg-secondary",
                    )}
                  >
                    <span className="flex w-[15px] justify-center">
                      {d.depth < 2 && (
                        <ChevronDown
                          className="size-3.5"
                          style={{ color: active ? "#4f46e5" : "#94a3b8" }}
                        />
                      )}
                    </span>
                    {d.depth < 2 ? (
                      <FolderOpen
                        className="size-3.5"
                        style={{ color: active ? "#4f46e5" : "#94a3b8" }}
                      />
                    ) : (
                      <Users
                        className="size-3.5"
                        style={{ color: active ? "#4f46e5" : "#94a3b8" }}
                      />
                    )}
                    <span className="flex-1 truncate text-left">{d.name}</span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums"
                      style={{
                        background: active ? "#e0e7ff" : "#f1f5f9",
                        color: active ? "#4338ca" : "#64748b",
                      }}
                    >
                      {d.count}
                    </span>
                  </button>
                  {isAdmin && isTeam && (
                    <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        title="구성원 추가"
                        onClick={() => setAssignTeamId(d.key)}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                      >
                        <UserPlus className="size-3" />
                      </button>
                      <button
                        title="이름 변경"
                        onClick={() => {
                          const next = window.prompt("팀 이름", d.name);
                          if (next?.trim()) updateTeam(d.key, { name: next.trim() });
                        }}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        title="팀 삭제"
                        onClick={() => {
                          if (
                            window.confirm(
                              `"${d.name}" 팀을 삭제할까요? 소속 인원의 팀 배정은 해제됩니다.`,
                            )
                          ) {
                            removeTeam(d.key);
                            if (dept === d.key) setDept(ROOT_FILTER);
                          }
                        }}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {isAdmin && <AddTeamForm teams={teams} onAdd={addTeam} />}
          </GwCard>
        </aside>

        <div className="flex min-w-[320px] flex-[1_1_560px] flex-col gap-4">
          {view === "grid" ? (
            people.length === 0 ? (
              <EmptyState
                tint={["#f0fdf4", "#15803d"]}
                icon={<Users className="size-[26px]" />}
                title={query || dept !== "전체" ? "일치하는 구성원이 없습니다" : "등록된 구성원이 없습니다"}
                desc={
                  query || dept !== "전체"
                    ? "검색어나 부서 필터를 완화해 보세요."
                    : "구성원을 추가하거나 멤버를 초대하면 조직도에 표시됩니다."
                }
                cta={
                  query || dept !== "전체"
                    ? undefined
                    : {
                        label: "새 구성원 추가",
                        icon: <Plus className="size-4" />,
                        onClick: () => setAddOpen(true),
                      }
                }
                alt={
                  query || dept !== "전체"
                    ? undefined
                    : { label: "멤버 초대", href: "/admin/invite" }
                }
              />
            ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-3.5">
              {people.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  onOpen={() => setProfileId(p.id)}
                />
              ))}
            </div>
            )
          ) : (
            <GwCard className="overflow-x-auto p-6">
              <div className="flex min-w-[720px] flex-col items-center">
                <button
                  onClick={() => ceo && setProfileId(ceo.id)}
                  disabled={!ceo}
                  className="w-[214px] rounded-xl bg-[#1e293b] p-3.5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.18)] transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-70"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        ...avatarStyle(ceoInitial, 36),
                        background: "#4f46e5",
                      }}
                    >
                      {ceoInitial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-slate-50">
                        {ceo?.name || workspace.ceo || "대표이사"}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-slate-400">
                        {ceo?.role ?? "대표이사"}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="h-5 w-px bg-[#cbd5e1]" />
                <div className="flex w-full items-stretch">
                  {branches.map((b, i) => {
                    const head = b.headId ? byId(b.headId) : undefined;
                    return (
                      <div
                        key={b.divisionId}
                        className="relative flex flex-1 flex-col items-center"
                      >
                        <div
                          className="absolute top-0 h-px bg-[#cbd5e1]"
                          style={{
                            left: i === 0 ? "50%" : 0,
                            right: i === branches.length - 1 ? "50%" : 0,
                          }}
                        />
                        <div className="h-5 w-px bg-[#cbd5e1]" />
                        {head ? (
                          <button
                            onClick={() => setProfileId(head.id)}
                            className="w-full max-w-[190px] rounded-[11px] border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-ring"
                          >
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <span style={avatarStyle(head.name.charAt(0), 34)}>
                                  {head.name.charAt(0)}
                                </span>
                                <span style={statusDot(head.status, 10, 2)} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12.5px] font-semibold">
                                  {head.name}
                                </div>
                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                  {head.role}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-[11px] font-semibold text-primary">
                              {b.divisionName}
                            </div>
                          </button>
                        ) : (
                          <div className="w-full max-w-[190px] rounded-[11px] border border-dashed border-[#cbd5e1] p-3 text-left">
                            <div className="text-[12.5px] font-semibold text-muted-foreground">
                              본부장 미배정
                            </div>
                            <div className="mt-2 text-[11px] font-semibold text-primary">
                              {b.divisionName}
                            </div>
                          </div>
                        )}
                        <div className="h-4 w-px bg-border" />
                        <div className="flex w-full max-w-[190px] flex-col gap-1.5 border-l border-border pl-3">
                          {b.teams.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                setDept(t.id);
                                setView("grid");
                              }}
                              className="flex items-center gap-2 rounded-[9px] border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary"
                            >
                              <span className="flex-1 truncate text-left">
                                {t.name}
                              </span>
                              <span className="rounded-full bg-[#f1f5f9] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-secondary-foreground">
                                {t.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </GwCard>
          )}
        </div>
      </div>

      {selected && (
        <ProfileDrawer
          person={selected}
          directory={directory}
          teams={teams}
          ceoId={ceo?.id ?? null}
          onClose={() => setProfileId(null)}
          onOpen={setProfileId}
          onSave={(patch) => updatePerson(selected.id, patch)}
          onDelete={async () => {
            await removePerson(selected.id);
            setProfileId(null);
          }}
        />
      )}

      {addOpen && (
        <AddPersonModal
          directory={directory}
          teams={teams}
          onClose={() => setAddOpen(false)}
          onSubmit={async (input) => {
            await addPerson(input);
            setAddOpen(false);
          }}
        />
      )}

      {assignTeam && (
        <AssignMemberModal
          team={assignTeam}
          directory={directory}
          onClose={() => setAssignTeamId(null)}
          onAssign={async (personId) => {
            await updatePerson(personId, { teamId: assignTeam.id });
            setAssignTeamId(null);
          }}
        />
      )}
    </div>
  );
}

function AddTeamForm({
  teams,
  onAdd,
}: {
  teams: { id: string; name: string; parentId: string | null }[];
  onAdd: (input: { name: string; parentId: string | null }) => Promise<unknown>;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [parentId, setParentId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const divisions = teams.filter((t) => t.parentId === null);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd({ name: name.trim(), parentId: parentId || null });
      setName("");
      setParentId("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-primary hover:bg-secondary"
      >
        <Plus className="size-3.5" />팀 추가
      </button>
    );
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-border p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="팀 이름"
        className="h-8 w-full rounded-md border border-border bg-card px-2 text-[12.5px] focus-visible:outline-none"
      />
      <select
        value={parentId}
        onChange={(e) => setParentId(e.target.value)}
        className="h-8 w-full rounded-md border border-border bg-card px-2 text-[12.5px] focus-visible:outline-none"
      >
        <option value="">본부(최상위)로 만들기</option>
        {divisions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} 밑에 팀으로 추가
          </option>
        ))}
      </select>
      <div className="flex gap-1.5">
        <button
          onClick={() => setOpen(false)}
          className="h-7.5 flex-1 rounded-md border border-border bg-card text-[11.5px] font-semibold text-muted-foreground hover:bg-secondary"
        >
          취소
        </button>
        <button
          onClick={submit}
          disabled={!name.trim() || saving}
          className="h-7.5 flex-[2] rounded-md bg-primary text-[11.5px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "추가 중…" : "추가"}
        </button>
      </div>
    </div>
  );
}

function AssignMemberModal({
  team,
  directory,
  onClose,
  onAssign,
}: {
  team: { id: string; name: string };
  directory: Person[];
  onClose: () => void;
  onAssign: (personId: string) => Promise<void>;
}) {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const candidates = directory
    .filter((p) => p.teamId !== team.id)
    .filter(
      (p) =>
        !query || (p.name + p.role + p.dept).toLowerCase().includes(query),
    )
    .slice(0, 20);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.015em]">
              {team.name}에 구성원 추가
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              기존 구성원을 검색해서 이 팀으로 배정합니다
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-3.5">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름, 직급, 부서로 검색"
            className={modalInput}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-1.5 pb-3.5">
          {candidates.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[12.5px] text-muted-foreground">
              일치하는 구성원이 없습니다
            </div>
          )}
          {candidates.map((p) => (
            <button
              key={p.id}
              onClick={() => onAssign(p.id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-secondary"
            >
              <span style={avatarStyle(p.name.charAt(0), 30)}>
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
              <Plus className="size-3.5 shrink-0 text-primary" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddPersonModal({
  directory,
  teams,
  onClose,
  onSubmit,
}: {
  directory: Person[];
  teams: { id: string; name: string; parentId: string | null }[];
  onClose: () => void;
  onSubmit: (input: PersonInput) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [teamId, setTeamId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [ext, setExt] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [boss, setBoss] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const valid = name.trim() && role.trim() && email.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    await onSubmit({
      name: name.trim(),
      role: role.trim(),
      teamId: teamId || null,
      email: email.trim(),
      ext: ext.trim(),
      mobile: mobile.trim(),
      status: "online",
      boss: boss || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#eef2ff] text-primary">
            <UserPlus className="size-4" />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.015em]">
              가계정 추가
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              아직 초대 전인 사람을 조직도에 미리 등록합니다 — 실제 로그인 계정은 없습니다
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
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="이름" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className={modalInput}
                required
              />
            </ModalField>
            <ModalField label="직급 / 직책" required>
              <PositionSelect
                value={role}
                onChange={setRole}
                required
                className={modalInput}
              />
            </ModalField>
            <ModalField label="팀">
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className={modalInput}
              >
                <option value="">미배정</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="이메일" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@company.com"
                className={modalInput}
                required
              />
            </ModalField>
            <ModalField label="내선">
              <input
                value={ext}
                onChange={(e) => setExt(e.target.value)}
                placeholder="2100"
                className={modalInput}
              />
            </ModalField>
            <ModalField label="휴대폰">
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="010-0000-0000"
                className={modalInput}
              />
            </ModalField>
            <ModalField label="직속 상사 (Reports to)">
              <select
                value={boss}
                onChange={(e) => setBoss(e.target.value)}
                className={modalInput}
              >
                <option value="">없음 (최상위)</option>
                {directory.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.role}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="담당 업무 태그 (쉼표로 구분)">
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="React, 디자인시스템"
                className={modalInput}
              />
            </ModalField>
          </div>
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
            {saving ? "추가하는 중…" : "가계정 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalInput =
  "h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

function ModalField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-[#e11d48]">*</span>}
      </div>
      {children}
    </div>
  );
}

function PersonCard({
  person: p,
  onOpen,
}: {
  person: Person;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="rounded-[14px] border border-border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-ring hover:shadow-[0_8px_20px_rgba(79,70,229,0.12)]"
    >
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <span style={avatarStyle(p.name.charAt(0), 44)}>
            {p.name.charAt(0)}
          </span>
          {!p.placeholder && <span style={statusDot(p.status, 12, 2)} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-[-0.015em]">
              {p.name}
            </span>
            <span className="text-xs text-muted-foreground">{p.role}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {p.dept}
          </div>
        </div>
        {p.placeholder ? (
          <span style={pill("#f1f5f9", "#64748b")}>가계정</span>
        ) : (
          <span style={statusPill(p.status)}>{STATUS_META[p.status].label}</span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1.5 text-xs text-secondary-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          <Mail className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{p.email}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone className="size-3 text-muted-foreground" />
          <span>내선 {p.ext}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.tags.map((t) => (
          <span key={t} style={pill("#f1f5f9", "#475569")}>
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

function ProfileDrawer({
  person: p,
  directory,
  teams,
  ceoId,
  onClose,
  onOpen,
  onSave,
  onDelete,
}: {
  person: Person;
  directory: Person[];
  teams: { id: string; name: string; parentId: string | null }[];
  ceoId: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onSave: (patch: Partial<PersonInput>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState(() => ({
    name: p.name,
    role: p.role,
    teamId: p.teamId ?? "",
    email: p.email,
    ext: p.ext,
    mobile: p.mobile,
    status: p.status,
    boss: p.boss ?? "",
    tags: (p.tags ?? []).join(", "),
  }));

  const boss =
    p.boss === null || p.boss === undefined
      ? null
      : (directory.find((x) => x.id === p.boss) ?? null);
  const mates = directory.filter(
    (x) => x.teamId === p.teamId && x.teamId !== null && x.id !== p.id,
  );

  const saveForm = async () => {
    if (!form.name.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        role: form.role.trim(),
        teamId: form.teamId || null,
        email: form.email.trim(),
        ext: form.ext.trim(),
        mobile: form.mobile.trim(),
        status: form.status,
        boss: form.boss || null,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (busy) return;
    const msg = p.placeholder
      ? `${p.name} 가계정을 삭제할까요? 되돌릴 수 없습니다.`
      : `${p.name} 님을 조직도에서 삭제할까요? 되돌릴 수 없습니다.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0f172a]/40"
      onClick={onClose}
    >
      <div
        className="animate-step flex h-full w-full max-w-[396px] flex-col bg-card shadow-[-18px_0_48px_rgba(15,23,42,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#eef1f5] px-4.5 py-4">
          <span className="text-[13px] font-semibold tracking-[-0.01em]">
            {editing ? "프로필 편집" : "임직원 프로필"}
          </span>
          {!editing && p.id !== ceoId && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="ml-auto flex h-7.5 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[12px] font-semibold text-secondary-foreground hover:bg-secondary"
              >
                <Pencil className="size-3" />
                편집
              </button>
              <button
                onClick={del}
                disabled={busy}
                className="flex size-7.5 items-center justify-center rounded-lg border border-[#fecaca] text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-50"
                aria-label="구성원 삭제"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className={cn(
              "flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-[#f1f5f9]",
              (editing || p.id === ceoId) && "ml-auto",
            )}
          >
            <X className="size-4" />
          </button>
        </div>

        {editing ? (
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 p-4.5">
              <ModalField label="이름" required>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className={modalInput}
                />
              </ModalField>
              <ModalField label="직급 / 직책">
                <PositionSelect
                  value={form.role}
                  onChange={(v) => setForm((f) => ({ ...f, role: v }))}
                  className={modalInput}
                />
              </ModalField>
              <ModalField label="팀">
                <select
                  value={form.teamId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, teamId: e.target.value }))
                  }
                  className={modalInput}
                >
                  <option value="">미배정</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </ModalField>
              <ModalField label="이메일">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={modalInput}
                />
              </ModalField>
              <ModalField label="내선">
                <input
                  value={form.ext}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ext: e.target.value }))
                  }
                  className={modalInput}
                />
              </ModalField>
              <ModalField label="휴대폰">
                <input
                  value={form.mobile}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mobile: e.target.value }))
                  }
                  className={modalInput}
                />
              </ModalField>
              {!p.placeholder && (
                <ModalField label="상태">
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as PersonStatus,
                      }))
                    }
                    className={modalInput}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </ModalField>
              )}
              <ModalField label="직속 상사">
                <select
                  value={form.boss}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, boss: e.target.value }))
                  }
                  className={modalInput}
                >
                  <option value="">없음 (최상위)</option>
                  {directory
                    .filter((x) => x.id !== p.id && x.id !== ceoId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} · {x.role}
                      </option>
                    ))}
                </select>
              </ModalField>
              <div className="col-span-2">
                <ModalField label="담당 업무 태그 (쉼표로 구분)">
                  <input
                    value={form.tags}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tags: e.target.value }))
                    }
                    placeholder="React, 디자인시스템"
                    className={modalInput}
                  />
                </ModalField>
              </div>
            </div>
            <div className="mt-auto flex gap-2 border-t border-[#eef1f5] bg-secondary px-4.5 py-3.5">
              <button
                onClick={() => setEditing(false)}
                className="h-10 flex-1 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-[#f1f5f9]"
              >
                취소
              </button>
              <button
                onClick={saveForm}
                disabled={!form.name.trim() || busy}
                className={cn(
                  "h-10 flex-[2] rounded-[10px] text-[13px] font-semibold transition-colors",
                  !form.name.trim() || busy
                    ? "cursor-not-allowed bg-[#f1f5f9] text-muted-foreground"
                    : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
                )}
              >
                {busy ? "저장 중…" : "변경 사항 저장"}
              </button>
            </div>
          </div>
        ) : (
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4.5">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <span style={avatarStyle(p.name.charAt(0), 64)}>
                {p.name.charAt(0)}
              </span>
              {!p.placeholder && <span style={statusDot(p.status, 16, 3)} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tracking-[-0.025em]">
                  {p.name}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {p.role}
                </span>
              </div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                {p.dept}
              </div>
              {p.placeholder ? (
                <span className="mt-2 inline-block" style={pill("#f1f5f9", "#64748b")}>
                  미입사 · 가계정
                </span>
              ) : (
                <span className="mt-2 inline-block" style={statusPill(p.status)}>
                  {STATUS_META[p.status].label}
                </span>
              )}
            </div>
          </div>

          {p.placeholder && (
            <Link
              href={`/admin/invite?fromPlaceholder=${p.id}`}
              className="flex h-9.5 items-center justify-center gap-1.5 rounded-[10px] bg-primary text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
            >
              <UserPlus className="size-4" />
              초대 링크 만들기
            </Link>
          )}

          <div className="flex gap-2">
            <a
              href={`mailto:${p.email}`}
              className="flex h-9.5 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-primary text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
            >
              <Mail className="size-4" />
              이메일
            </a>
            <a
              href={`sms:${p.mobile}`}
              className="flex h-9.5 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-secondary"
            >
              <MessageSquare className="size-4" />
              메시지
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
              연락처
            </div>
            {[
              { icon: Mail, label: "이메일", value: p.email },
              { icon: Phone, label: "내선", value: p.ext },
              { icon: Smartphone, label: "휴대폰", value: p.mobile },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-[10px] border border-[#eef1f5] bg-secondary px-3 py-2.5"
              >
                <Icon className="size-[15px] text-muted-foreground" />
                <span className="w-[58px] shrink-0 text-[11.5px] text-muted-foreground">
                  {label}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px]">
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
              담당 업무
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span key={t} style={pill("#eef2ff", "#4338ca")}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {boss && (
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
                직속 상사 (Reports to)
              </div>
              <button
                onClick={() => onOpen(boss.id)}
                className="flex items-center gap-2.5 rounded-[11px] border border-border p-3 transition-colors hover:border-ring hover:bg-secondary"
              >
                <span style={avatarStyle(boss.name.charAt(0), 34)}>
                  {boss.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-[13px] font-semibold">{boss.name}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {boss.role} · {boss.dept}
                  </div>
                </div>
                <ChevronRight className="size-3.5 text-[#cbd5e1]" />
              </button>
            </div>
          )}

          {mates.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
                  소속 팀원
                </span>
                <span className="text-[11px] text-[#cbd5e1]">
                  {mates.length}명
                </span>
              </div>
              {mates.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onOpen(m.id)}
                  className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-secondary"
                >
                  <div className="relative">
                    <span style={avatarStyle(m.name.charAt(0), 30)}>
                      {m.name.charAt(0)}
                    </span>
                    <span style={statusDot(m.status, 10, 2)} />
                  </div>
                  <div className="min-w-0 flex-1 text-left text-[12.5px] font-semibold">
                    {m.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      {m.role}
                    </span>
                  </div>
                  <span className="tabular-nums text-[11.5px] text-muted-foreground">
                    {m.ext}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
