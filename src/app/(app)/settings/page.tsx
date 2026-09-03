"use client";

import * as React from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  HardDrive,
  Info,
  Laptop,
  Lock,
  Mail,
  MessageSquare,
  MessagesSquare,
  Minus,
  Monitor,
  PenLine,
  Plug,
  ShieldCheck,
  Smartphone,
  Tablet,
  Upload,
  User,
  UserPlus,
  Users,
  Webhook,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPANY_FIELDS,
  INTEGRATIONS,
  NOTIFY_GROUPS,
  PENDING_MEMBERS,
  RBAC_ROWS,
  ROLE_COLS,
  SESSIONS,
} from "@/lib/groupware/data";
import { avatarStyle, pill } from "@/lib/groupware/ui";
import { GwCard } from "@/components/app/primitives";

type Tab =
  | "profile"
  | "notify"
  | "security"
  | "company"
  | "members"
  | "integration";

const PERSONAL_TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profile", label: "내 프로필", icon: User },
  { key: "notify", label: "알림 설정", icon: Bell },
  { key: "security", label: "보안 / 비밀번호", icon: ShieldCheck },
];
const ADMIN_TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "company", label: "회사 정보", icon: Building2 },
  { key: "members", label: "권한 / 멤버 관리", icon: Users },
  { key: "integration", label: "연동 서비스", icon: Plug },
];

const NOTIFY_ICONS: Record<string, React.ElementType> = { Bell, Mail, Webhook };
const SESSION_ICONS: Record<string, React.ElementType> = {
  Laptop,
  Smartphone,
  Monitor,
  Tablet,
};
const INT_ICONS: Record<string, React.ElementType> = {
  MessageSquare,
  MessagesSquare,
  CalendarDays,
  HardDrive,
};

function Toggle({
  on,
  onClick,
}: {
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative h-6 w-[42px] shrink-0 rounded-full transition-colors",
        on ? "bg-primary" : "bg-[#cbd5e1]",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-[left]",
          on ? "left-[21px]" : "left-[3px]",
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = React.useState<Tab>("profile");
  const [dirty, setDirty] = React.useState(false);
  const [name, setName] = React.useState("김세진");
  const [email, setEmail] = React.useState("sejin.kim@nextcore.io");
  const [twoFA, setTwoFA] = React.useState(true);
  const [toggles, setToggles] = React.useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    NOTIFY_GROUPS.forEach((g) => g.rows.forEach((r) => (m[r.key] = r.on)));
    return m;
  });
  const [ints, setInts] = React.useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    INTEGRATIONS.forEach((i) => (m[i.name] = i.on));
    return m;
  });

  const touch = () => setDirty(true);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 pb-20">
      <div>
        <h1 className="text-xl font-bold tracking-[-0.025em]">설정 및 관리</h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          개인 환경설정과 워크스페이스 관리자 설정
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <aside className="min-w-[216px] flex-[0_1_236px]">
          <GwCard className="p-2.5">
            <div className="px-2.5 pb-1.5 pt-2 text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
              개인 설정
            </div>
            {PERSONAL_TABS.map((t) => (
              <TabBtn key={t.key} t={t} active={tab === t.key} onClick={() => setTab(t.key)} />
            ))}
            <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
              워크스페이스 관리
              <span
                className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold text-[#4338ca]"
                style={{ background: "#eef2ff" }}
              >
                ADMIN
              </span>
            </div>
            {ADMIN_TABS.map((t) => (
              <TabBtn key={t.key} t={t} active={tab === t.key} onClick={() => setTab(t.key)} />
            ))}
          </GwCard>
        </aside>

        <div className="flex min-w-[320px] flex-[1_1_560px] flex-col gap-4">
          {tab === "profile" && (
            <GwCard className="flex flex-col gap-5 p-5.5">
              <div>
                <h3 className="text-[14.5px] font-semibold tracking-[-0.015em]">
                  내 프로필
                </h3>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  사내 디렉토리와 전자결재 문서에 표시되는 정보입니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span style={avatarStyle("김", 64)}>김</span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <button className="flex h-8.5 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary">
                      <Upload className="size-3.5" />
                      이미지 변경
                    </button>
                    <button className="h-8.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-muted-foreground hover:bg-secondary">
                      삭제
                    </button>
                  </div>
                  <span className="text-[11.5px] text-muted-foreground">
                    PNG, JPG · 최대 2MB · 권장 400×400px
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
                <Field label="이름">
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      touch();
                    }}
                    className={fieldInput}
                  />
                </Field>
                <Field label="이메일">
                  <input
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      touch();
                    }}
                    className={fieldInput}
                  />
                </Field>
                <Field label="부서" readOnly>
                  <ReadOnly>기술본부 · 플랫폼개발팀</ReadOnly>
                </Field>
                <Field label="직급" readOnly>
                  <ReadOnly>과장 (M2)</ReadOnly>
                </Field>
                <Field label="언어">
                  <button
                    onClick={touch}
                    className={cn(fieldInput, "flex items-center text-left")}
                  >
                    <span className="flex-1">한국어 (Korean)</span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                </Field>
                <Field label="타임존">
                  <button
                    onClick={touch}
                    className={cn(fieldInput, "flex items-center text-left")}
                  >
                    <span className="flex-1">(GMT+09:00) 서울</span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                </Field>
              </div>
              <div className="border-t border-[#f1f5f9] pt-4.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">전자결재 서명</span>
                  <span className="text-[11.5px] text-muted-foreground">
                    결재 문서 하단에 자동 삽입됩니다
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-stretch gap-3.5">
                  <div className="flex min-h-[108px] flex-[1_1_260px] flex-col items-center justify-center gap-1.5 rounded-[11px] border border-border bg-card p-3.5">
                    <div className="font-mono text-[10.5px] tracking-[0.04em] text-[#cbd5e1]">
                      SIGNATURE PREVIEW
                    </div>
                    <div className="text-[26px] font-medium tracking-[-0.02em]">
                      김 세 진
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      플랫폼개발팀 · 과장
                    </div>
                  </div>
                  <div className="flex flex-[1_1_200px] flex-col justify-center gap-2">
                    <button className="flex h-9.5 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[#cbd5e1] bg-secondary text-[12.5px] font-semibold text-secondary-foreground hover:border-ring hover:bg-[#f5f6ff]">
                      <Upload className="size-3.5" />
                      서명 이미지 업로드
                    </button>
                    <button className="flex h-9.5 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary">
                      <PenLine className="size-3.5" />
                      직접 그려서 등록
                    </button>
                  </div>
                </div>
              </div>
            </GwCard>
          )}

          {tab === "notify" &&
            NOTIFY_GROUPS.map((g) => {
              const Icon = NOTIFY_ICONS[g.icon];
              return (
                <GwCard key={g.title} className="p-5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px]"
                      style={{ background: g.bg }}
                    >
                      <Icon className="size-4" style={{ color: g.color }} />
                    </span>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold tracking-[-0.015em]">
                        {g.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {g.desc}
                      </p>
                    </div>
                    {g.webhook && (
                      <span style={pill("#f0fdf4", "#15803d")}>{g.webhook}</span>
                    )}
                  </div>
                  <div className="mt-3.5 flex flex-col">
                    {g.rows.map((r) => (
                      <div
                        key={r.key}
                        className="flex items-center gap-3 border-t border-[#f1f5f9] py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium">
                            {r.label}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                            {r.hint}
                          </div>
                        </div>
                        <Toggle
                          on={toggles[r.key]}
                          onClick={() => {
                            setToggles((p) => ({ ...p, [r.key]: !p[r.key] }));
                            touch();
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </GwCard>
              );
            })}

          {tab === "security" && (
            <>
              <GwCard className="flex flex-col gap-4.5 p-5.5">
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: "#eef2ff" }}
                  >
                    <ShieldCheck className="size-[17px] text-primary" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold tracking-[-0.015em]">
                      2단계 인증 (2FA)
                    </h3>
                    <p className="mt-1 text-[12.5px] leading-[1.6] text-muted-foreground">
                      OTP 앱으로 발급된 6자리 코드를 로그인 시 추가로 입력합니다.
                    </p>
                  </div>
                  <Toggle
                    on={twoFA}
                    onClick={() => {
                      setTwoFA((v) => !v);
                      touch();
                    }}
                  />
                </div>
                <div
                  className="flex items-center gap-2 rounded-[10px] border p-3 text-[12px] leading-[1.5]"
                  style={
                    twoFA
                      ? {
                          background: "#f5f6ff",
                          borderColor: "#e0e7ff",
                          color: "#4338ca",
                        }
                      : {
                          background: "#fff7ed",
                          borderColor: "#fed7aa",
                          color: "#c2410c",
                        }
                  }
                >
                  <Info className="size-3.5 shrink-0" />
                  {twoFA
                    ? "Google Authenticator 등록됨 · 백업 코드 8개 중 6개 사용 가능"
                    : "2FA가 꺼져 있습니다. 관리자 정책에 따라 30일 내 활성화가 필요합니다."}
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5 border-t border-[#f1f5f9] pt-4.5">
                  <Field label="새 비밀번호">
                    <input type="password" defaultValue="1234567890" className={fieldInput} />
                  </Field>
                  <Field label="새 비밀번호 확인">
                    <input type="password" defaultValue="1234567890" className={fieldInput} />
                  </Field>
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  마지막 변경 2026.05.12 · 90일마다 변경이 권장됩니다
                </div>
              </GwCard>

              <GwCard>
                <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 py-4">
                  <h3 className="text-sm font-semibold tracking-[-0.015em]">
                    최근 접속 기기
                  </h3>
                  <span className="text-[11.5px] text-muted-foreground">
                    4개 세션
                  </span>
                  <button className="ml-auto h-8 rounded-[9px] border border-[#fecaca] bg-card px-3 text-[12.5px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2]">
                    전체 강제 로그아웃
                  </button>
                </div>
                {SESSIONS.map((d) => {
                  const Icon = SESSION_ICONS[d.icon];
                  return (
                    <div
                      key={d.device}
                      className="flex items-center gap-3 border-b border-[#f1f5f9] px-5 py-3.5"
                    >
                      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] border border-[#eef1f5] bg-secondary">
                        <Icon className="size-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold">
                            {d.device}
                          </span>
                          {d.current && (
                            <span
                              className="rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold text-[#15803d]"
                              style={{ background: "#f0fdf4" }}
                            >
                              현재 세션
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {d.meta}
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-[11.5px] tabular-nums text-muted-foreground">
                        {d.time}
                      </span>
                      <button
                        disabled={d.current}
                        className={cn(
                          "h-7.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold",
                          d.current
                            ? "cursor-not-allowed border border-[#eef1f5] bg-secondary text-[#cbd5e1]"
                            : "border border-border bg-card text-secondary-foreground hover:bg-secondary",
                        )}
                      >
                        {d.current ? "현재 기기" : "로그아웃"}
                      </button>
                    </div>
                  );
                })}
              </GwCard>
            </>
          )}

          {tab === "members" && (
            <>
              <GwCard>
                <div className="flex flex-wrap items-center gap-2.5 border-b border-[#eef1f5] px-5 py-4">
                  <div>
                    <h3 className="text-sm font-semibold tracking-[-0.015em]">
                      역할 기반 접근 제어 (RBAC)
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      역할별로 워크스페이스 기능 권한을 설정합니다
                    </p>
                  </div>
                  <button className="ml-auto flex h-8.5 items-center gap-1.5 rounded-[9px] bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover">
                    <UserPlus className="size-3.5" />
                    멤버 초대
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex min-w-[720px] border-b border-[#eef1f5] bg-secondary px-5 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
                    <div className="min-w-[200px] flex-1">권한</div>
                    {ROLE_COLS.map((rc) => (
                      <div key={rc} className="w-[110px] shrink-0 text-center">
                        {rc}
                      </div>
                    ))}
                  </div>
                  {RBAC_ROWS.map((r) => (
                    <div
                      key={r.label}
                      className="flex min-w-[720px] items-center border-b border-[#f1f5f9] px-5 py-3"
                    >
                      <div className="min-w-[200px] flex-1 pr-3.5">
                        <div className="text-[13px] font-medium">{r.label}</div>
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {r.hint}
                        </div>
                      </div>
                      {r.cells.map((c, i) => (
                        <div
                          key={i}
                          className="flex w-[110px] shrink-0 justify-center"
                        >
                          <span
                            className="flex size-[22px] items-center justify-center rounded-[7px]"
                            style={{
                              background:
                                c === 2
                                  ? "#f0fdf4"
                                  : c === 1
                                    ? "#fff7ed"
                                    : "#f8fafc",
                            }}
                          >
                            {c === 2 ? (
                              <Check
                                className="size-3.5 text-[#15803d]"
                                strokeWidth={2.6}
                              />
                            ) : c === 1 ? (
                              <Minus
                                className="size-3.5 text-[#c2410c]"
                                strokeWidth={2.6}
                              />
                            ) : (
                              <X
                                className="size-3 text-[#cbd5e1]"
                                strokeWidth={2.4}
                              />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </GwCard>

              <GwCard>
                <div className="flex items-center gap-2 border-b border-[#eef1f5] px-5 py-4">
                  <h3 className="text-sm font-semibold tracking-[-0.015em]">
                    승인 대기 계정
                  </h3>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold text-[#c2410c]"
                    style={{ background: "#fff7ed" }}
                  >
                    3건 대기
                  </span>
                </div>
                {PENDING_MEMBERS.map((m) => (
                  <div
                    key={m.email}
                    className="flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] px-5 py-3.5"
                  >
                    <span style={avatarStyle(m.name.charAt(0), 36)}>
                      {m.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-[1_1_180px]">
                      <div className="text-[13px] font-semibold">
                        {m.name}{" "}
                        <span className="font-normal text-muted-foreground">
                          {m.role}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                        {m.email} · {m.dept}
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
                      {m.requested}
                    </span>
                    <div className="flex gap-1.5">
                      <button className="h-8 rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-muted-foreground hover:bg-secondary">
                        거절
                      </button>
                      <button className="h-8 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover">
                        승인
                      </button>
                    </div>
                  </div>
                ))}
              </GwCard>
            </>
          )}

          {tab === "company" && (
            <GwCard className="flex flex-col gap-4.5 p-5.5">
              <div>
                <h3 className="text-[14.5px] font-semibold tracking-[-0.015em]">
                  회사 정보
                </h3>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  전자결재 문서와 사내 안내에 표시되는 기본 정보입니다.
                </p>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
                {COMPANY_FIELDS.map((c) => (
                  <Field key={c.label} label={c.label}>
                    <div className="flex h-9.5 items-center rounded-[9px] border border-border bg-card px-3 text-[13px]">
                      {c.value}
                    </div>
                  </Field>
                ))}
              </div>
            </GwCard>
          )}

          {tab === "integration" && (
            <GwCard className="p-5">
              <div>
                <h3 className="text-[14.5px] font-semibold tracking-[-0.015em]">
                  연동 서비스
                </h3>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  외부 서비스와 알림 · 일정 · 파일을 연동합니다.
                </p>
              </div>
              <div className="mt-3.5 flex flex-col">
                {INTEGRATIONS.map((i) => {
                  const Icon = INT_ICONS[i.icon];
                  const on = ints[i.name];
                  return (
                    <div
                      key={i.name}
                      className="flex items-center gap-3 border-t border-[#f1f5f9] py-3.5"
                    >
                      <span
                        className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px]"
                        style={{ background: i.bg }}
                      >
                        <Icon className="size-4" style={{ color: i.color }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold">
                            {i.name}
                          </span>
                          <span
                            style={pill(
                              on ? "#f0fdf4" : "#f1f5f9",
                              on ? "#15803d" : "#94a3b8",
                            )}
                          >
                            {on ? "연동됨" : "미연동"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {i.desc}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setInts((p) => ({ ...p, [i.name]: !p[i.name] }));
                          touch();
                        }}
                        className={cn(
                          "h-8 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-semibold",
                          on
                            ? "border border-border bg-card text-muted-foreground"
                            : "bg-primary text-primary-foreground",
                        )}
                      >
                        {on ? "연동 해제" : "연동하기"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </GwCard>
          )}
        </div>
      </div>

      {/* 저장 액션 바 */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-[#334155] bg-[#1e293b]/95 px-6 py-3 backdrop-blur transition-transform lg:left-66",
          dirty ? "translate-y-0" : "translate-y-full",
        )}
      >
        <span className="flex items-center gap-2 text-[12.5px] text-[#cbd5e1]">
          <CircleDot className="size-3.5" />
          저장하지 않은 변경 사항이 있습니다
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setDirty(false)}
            className="h-9 rounded-[9px] border border-[#475569] px-3.5 text-[13px] font-semibold text-slate-200"
          >
            취소
          </button>
          <button
            onClick={() => setDirty(false)}
            className="h-9 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-white"
          >
            변경사항 저장
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  t,
  active,
  onClick,
}: {
  t: { label: string; icon: React.ElementType };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = t.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[9px] p-2.5 text-[12.5px] tracking-[-0.01em] transition-colors",
        active
          ? "bg-accent font-semibold text-accent-foreground"
          : "font-medium text-secondary-foreground hover:bg-secondary",
      )}
    >
      <Icon
        className="size-[15px]"
        style={{ color: active ? "#4f46e5" : "#94a3b8" }}
      />
      <span className="flex-1 text-left">{t.label}</span>
    </button>
  );
}

const fieldInput =
  "h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

function Field({
  label,
  readOnly,
  children,
}: {
  label: string;
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
        {label}
        {readOnly && (
          <span className="ml-1 font-normal text-[#cbd5e1]">읽기 전용</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ReadOnly({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-9.5 items-center gap-2 rounded-[9px] border border-[#eef1f5] bg-secondary px-3 text-[13px] text-muted-foreground">
      <Lock className="size-3.5" />
      {children}
    </div>
  );
}
