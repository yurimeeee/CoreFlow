"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  Mail,
  MapPin,
  MessageSquare,
  Network,
  Phone,
  Search,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEPT_FILTERS,
  DEPT_TREE,
  ORG_BRANCHES,
  PEOPLE,
  STATUS_META,
  personById,
  type Person,
} from "@/lib/groupware/data";
import { avatarStyle, pill, statusDot, statusPill } from "@/lib/groupware/ui";
import { GwCard, PageHeader, Segmented } from "@/components/app/primitives";

export default function OrgPage() {
  const [view, setView] = React.useState<"grid" | "tree">("grid");
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("전체");
  const [profileId, setProfileId] = React.useState<number | null>(null);

  const q = query.trim().toLowerCase();
  const people = PEOPLE.filter((p) => p.id !== 0).filter(
    (p) =>
      (dept === "전체" || p.team === dept || p.dept.includes(dept)) &&
      (!q ||
        (p.name + p.role + p.dept + p.tags.join(" "))
          .toLowerCase()
          .includes(q)),
  );

  const ceo = personById(0)!;
  const selected = profileId === null ? null : personById(profileId);

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
      <PageHeader
        title="조직도 · 임직원 디렉토리"
        desc="넥스트코어 · 재직 인원 46명 · 4개 본부 8개 팀"
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
          {DEPT_FILTERS.map((d) => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                dept === d
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-secondary-foreground hover:bg-secondary",
              )}
            >
              {d}
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
            {DEPT_TREE.map((d) => {
              const active = dept === d.key;
              return (
                <div key={d.name} style={{ paddingLeft: d.depth * 12 }}>
                  <button
                    onClick={() => setDept(d.key)}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] tracking-[-0.01em] transition-colors",
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
                </div>
              );
            })}
          </GwCard>
        </aside>

        <div className="flex min-w-[320px] flex-[1_1_560px] flex-col gap-4">
          {view === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-3.5">
              {people.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  onOpen={() => setProfileId(p.id)}
                />
              ))}
            </div>
          ) : (
            <GwCard className="overflow-x-auto p-6">
              <div className="flex min-w-[720px] flex-col items-center">
                <button
                  onClick={() => setProfileId(0)}
                  className="w-[214px] rounded-xl bg-[#1e293b] p-3.5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.18)] transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        ...avatarStyle("노", 36),
                        background: "#4f46e5",
                      }}
                    >
                      노
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-slate-50">
                        {ceo.name}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-slate-400">
                        {ceo.role}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="h-5 w-px bg-[#cbd5e1]" />
                <div className="flex w-full items-stretch">
                  {ORG_BRANCHES.map((b, i) => {
                    const head = personById(b.head)!;
                    return (
                      <div
                        key={b.dept}
                        className="relative flex flex-1 flex-col items-center"
                      >
                        <div
                          className="absolute top-0 h-px bg-[#cbd5e1]"
                          style={{
                            left: i === 0 ? "50%" : 0,
                            right: i === ORG_BRANCHES.length - 1 ? "50%" : 0,
                          }}
                        />
                        <div className="h-5 w-px bg-[#cbd5e1]" />
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
                            {b.dept}
                          </div>
                        </button>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex w-full max-w-[190px] flex-col gap-1.5 border-l border-border pl-3">
                          {b.teams.map(([name, count]) => (
                            <button
                              key={name}
                              onClick={() => {
                                setDept(name);
                                setView("grid");
                              }}
                              className="flex items-center gap-2 rounded-[9px] border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary"
                            >
                              <span className="flex-1 truncate text-left">
                                {name}
                              </span>
                              <span className="rounded-full bg-[#f1f5f9] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-secondary-foreground">
                                {count}
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
          onClose={() => setProfileId(null)}
          onOpen={setProfileId}
        />
      )}
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
          <span style={statusDot(p.status, 12, 2)} />
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
        <span style={statusPill(p.status)}>{STATUS_META[p.status].label}</span>
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
  onClose,
  onOpen,
}: {
  person: Person;
  onClose: () => void;
  onOpen: (id: number) => void;
}) {
  const boss = p.boss === null ? null : personById(p.boss);
  const mates = PEOPLE.filter((x) => x.team === p.team && x.id !== p.id);

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
            임직원 프로필
          </span>
          <button
            onClick={onClose}
            className="ml-auto flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-[#f1f5f9]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4.5">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <span style={avatarStyle(p.name.charAt(0), 64)}>
                {p.name.charAt(0)}
              </span>
              <span style={statusDot(p.status, 16, 3)} />
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
              <span className="mt-2 inline-block" style={statusPill(p.status)}>
                {STATUS_META[p.status].label}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex h-9.5 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-primary text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover">
              <Mail className="size-4" />
              이메일
            </button>
            <button className="flex h-9.5 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-secondary">
              <MessageSquare className="size-4" />
              메시지
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
              연락처
            </div>
            {[
              { icon: Mail, label: "이메일", value: p.email },
              { icon: Phone, label: "내선", value: p.ext },
              { icon: Smartphone, label: "휴대폰", value: p.mobile },
              { icon: MapPin, label: "근무지", value: "본사 7F · 서울 강남" },
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
      </div>
    </div>
  );
}
