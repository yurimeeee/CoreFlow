"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  CircleDot,
  HardDrive,
  Info,
  Laptop,
  Loader2,
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
import { updatePassword } from "firebase/auth";
import { cn } from "@/lib/utils";
import { firebaseAuth } from "@/lib/firebase";
import {
  INTEGRATIONS,
  NOTIFY_GROUPS,
  RBAC_ROWS,
  ROLE_COLS,
  SESSIONS,
} from "@/lib/groupware/data";
import { WORKSPACE_FIELD_LABELS } from "@/lib/groupware/firestore";
import {
  useCurrentUser,
  useGwSettings,
  usePendingUsers,
  useWorkspace,
} from "@/lib/groupware/hooks";
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

const DEFAULT_TOGGLES: Record<string, boolean> = {};
NOTIFY_GROUPS.forEach((g) => g.rows.forEach((r) => (DEFAULT_TOGGLES[r.key] = r.on)));
const DEFAULT_INTS: Record<string, boolean> = {};
INTEGRATIONS.forEach((i) => (DEFAULT_INTS[i.name] = i.on));

interface Edits {
  name?: string;
  email?: string;
  twoFA?: boolean;
  toggles?: Record<string, boolean>;
  ints?: Record<string, boolean>;
  lang?: string;
  tz?: string;
  saving?: boolean;
  touched?: boolean;
}

const LANGS = ["한국어 (Korean)", "English", "日本語"];
const TIMEZONES = [
  "(GMT+09:00) 서울",
  "(GMT+00:00) UTC",
  "(GMT-08:00) 로스앤젤레스",
];

export default function SettingsPage() {
  const [tab, setTab] = React.useState<Tab>("profile");
  const { profile, canSave, save, uploadImage, clearImage } = useGwSettings();
  const me = useCurrentUser();
  const [edits, setEdits] = React.useState<Edits>({});
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = React.useState<string | null>(null);
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [pwBusy, setPwBusy] = React.useState(false);
  const [pwMsg, setPwMsg] = React.useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const isAdminTab = tab === "company" || tab === "members" || tab === "integration";
  const activeTab: Tab = isAdminTab && !isAdmin ? "profile" : tab;

  const gw = profile?.gwSettings;
  const name = edits.name ?? profile?.name ?? me.name;
  const email = edits.email ?? profile?.email ?? me.email ?? "";
  const twoFA = edits.twoFA ?? gw?.twoFA ?? true;
  const toggles = edits.toggles ?? gw?.toggles ?? DEFAULT_TOGGLES;
  const ints = edits.ints ?? gw?.integrations ?? DEFAULT_INTS;
  const lang = edits.lang ?? gw?.lang ?? LANGS[0];
  const tz = edits.tz ?? gw?.tz ?? TIMEZONES[0];
  const photo = avatarUrl ?? profile?.profileImageUrl ?? null;
  const signature = signatureUrl ?? profile?.signatureUrl ?? null;
  const dirty = Object.keys(edits).some((k) => k !== "saving");

  const setName = (v: string) => setEdits((e) => ({ ...e, name: v }));
  const setEmail = (v: string) => setEdits((e) => ({ ...e, email: v }));
  const setTwoFA = (fn: (p: boolean) => boolean) =>
    setEdits((e) => ({ ...e, twoFA: fn(e.twoFA ?? twoFA) }));
  const setToggles = (fn: (p: Record<string, boolean>) => Record<string, boolean>) =>
    setEdits((e) => ({ ...e, toggles: fn(e.toggles ?? toggles) }));
  const setInts = (fn: (p: Record<string, boolean>) => Record<string, boolean>) =>
    setEdits((e) => ({ ...e, ints: fn(e.ints ?? ints) }));
  const touch = () => setEdits((e) => ({ ...e, touched: true }));

  const pickImage = (kind: "profile" | "signature") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await uploadImage(kind, file);
      if (!url) return;
      if (kind === "profile") setAvatarUrl(url);
      else setSignatureUrl(url);
    };
    input.click();
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (pw.length < 8 || pw !== pw2) {
      setPwMsg({ ok: false, text: "8자 이상, 두 입력이 일치해야 합니다." });
      return;
    }
    const user = firebaseAuth().currentUser;
    if (!user) return;
    setPwBusy(true);
    try {
      await updatePassword(user, pw);
      setPwMsg({ ok: true, text: "비밀번호가 변경되었습니다." });
      setPw("");
      setPw2("");
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      setPwMsg({
        ok: false,
        text:
          code === "auth/requires-recent-login"
            ? "보안을 위해 다시 로그인한 뒤 변경해 주세요."
            : "비밀번호 변경에 실패했습니다.",
      });
    } finally {
      setPwBusy(false);
    }
  };

  const ua = React.useSyncExternalStore(
    () => () => {},
    () => navigator.userAgent,
    () => "",
  );
  const sessions = React.useMemo(() => {
    const current = ua
      ? [
          {
            device: /Mobi|Android|iPhone/.test(ua)
              ? "모바일 브라우저"
              : "이 브라우저",
            meta: ua.length > 64 ? `${ua.slice(0, 64)}…` : ua,
            time: "현재 접속 중",
            current: true,
            icon: "Monitor" as const,
          },
        ]
      : [];
    return [...current, ...SESSIONS];
  }, [ua]);

  const lastChanged = (() => {
    const u = profile?.updatedAt as { toDate?: () => Date } | Date | undefined;
    const d = u instanceof Date ? u : u?.toDate?.();
    return d
      ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
          d.getDate(),
        ).padStart(2, "0")}`
      : null;
  })();

  const commit = async () => {
    setEdits((e) => ({ ...e, saving: true }));
    // 이메일은 Firebase Auth 계정과 연동되므로 여기서는 저장하지 않습니다.
    await save({
      name,
      gwSettings: { toggles, integrations: ints, twoFA, lang, tz },
    });
    setEdits({});
  };

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
            {isAdmin && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold tracking-[0.03em] text-muted-foreground">
                  워크스페이스 관리
                  <span
                    className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold text-[#4338ca]"
                    style={{ background: "#eef2ff" }}
                  >
                    {profile?.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}
                  </span>
                </div>
                {ADMIN_TABS.map((t) => (
                  <TabBtn key={t.key} t={t} active={tab === t.key} onClick={() => setTab(t.key)} />
                ))}
              </>
            )}
          </GwCard>
        </aside>

        <div className="flex min-w-[320px] flex-[1_1_560px] flex-col gap-4">
          {activeTab === "profile" && (
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
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={name}
                    className="size-16 rounded-full object-cover"
                  />
                ) : (
                  <span style={avatarStyle(name.charAt(0), 64)}>
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => pickImage("profile")}
                      disabled={!canSave}
                      className="flex h-8.5 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary disabled:opacity-50"
                    >
                      <Upload className="size-3.5" />
                      이미지 변경
                    </button>
                    {photo && (
                      <button
                        onClick={async () => {
                          await clearImage("profile");
                          setAvatarUrl(null);
                        }}
                        className="h-8.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-muted-foreground hover:bg-secondary"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <span className="text-[11.5px] text-muted-foreground">
                    PNG, JPG · 최대 5MB · 권장 400×400px
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
                  <ReadOnly>{profile?.departmentId || "미배정"}</ReadOnly>
                </Field>
                <Field label="직급" readOnly>
                  <ReadOnly>{profile?.position || "미배정"}</ReadOnly>
                </Field>
                <Field label="언어">
                  <select
                    value={lang}
                    onChange={(e) =>
                      setEdits((s) => ({ ...s, lang: e.target.value }))
                    }
                    className={fieldInput}
                  >
                    {LANGS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="타임존">
                  <select
                    value={tz}
                    onChange={(e) =>
                      setEdits((s) => ({ ...s, tz: e.target.value }))
                    }
                    className={fieldInput}
                  >
                    {TIMEZONES.map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </select>
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
                    {signature ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={signature}
                        alt="전자결재 서명"
                        className="max-h-[72px] object-contain"
                      />
                    ) : (
                      <>
                        <div className="font-mono text-[10.5px] tracking-[0.04em] text-[#cbd5e1]">
                          SIGNATURE PREVIEW
                        </div>
                        <div className="text-[26px] font-medium tracking-[-0.02em]">
                          {name.split("").join(" ")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {profile?.departmentId || "부서 미배정"}
                          {profile?.position ? ` · ${profile.position}` : ""}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-[1_1_200px] flex-col justify-center gap-2">
                    <button
                      onClick={() => pickImage("signature")}
                      disabled={!canSave}
                      className="flex h-9.5 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[#cbd5e1] bg-secondary text-[12.5px] font-semibold text-secondary-foreground hover:border-ring hover:bg-[#f5f6ff] disabled:opacity-50"
                    >
                      <Upload className="size-3.5" />
                      서명 이미지 업로드
                    </button>
                    {signature && (
                      <button
                        onClick={async () => {
                          await clearImage("signature");
                          setSignatureUrl(null);
                        }}
                        className="flex h-9.5 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
                      >
                        <PenLine className="size-3.5" />
                        서명 삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </GwCard>
          )}

          {activeTab === "notify" &&
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
                        {g.icon === "Mail" && email
                          ? `${email} 로 발송됩니다`
                          : g.desc}
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

          {activeTab === "security" && (
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
                    <input
                      type="password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      autoComplete="new-password"
                      className={fieldInput}
                    />
                  </Field>
                  <Field label="새 비밀번호 확인">
                    <input
                      type="password"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      autoComplete="new-password"
                      className={fieldInput}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={changePassword}
                    disabled={pwBusy || !canSave || !pw}
                    className="h-9 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                  >
                    {pwBusy ? "변경 중…" : "비밀번호 변경"}
                  </button>
                  {pwMsg && (
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: pwMsg.ok ? "#15803d" : "#b91c1c" }}
                    >
                      {pwMsg.text}
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {lastChanged
                    ? `마지막 변경 ${lastChanged} · 90일마다 변경이 권장됩니다`
                    : "90일마다 비밀번호 변경이 권장됩니다"}
                </div>
              </GwCard>

              <GwCard>
                <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 py-4">
                  <h3 className="text-sm font-semibold tracking-[-0.015em]">
                    최근 접속 기기
                  </h3>
                  <span className="text-[11.5px] text-muted-foreground">
                    {sessions.length}개 세션
                  </span>
                  <button
                    onClick={() => {
                      if (confirm("이 기기에서 로그아웃할까요?")) me.logout();
                    }}
                    className="ml-auto h-8 rounded-[9px] border border-[#fecaca] bg-card px-3 text-[12.5px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2]"
                  >
                    전체 강제 로그아웃
                  </button>
                </div>
                {sessions.map((d) => {
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
                        onClick={() => !d.current && me.logout()}
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

          {activeTab === "members" && (
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
                  <Link
                    href="/admin/invite"
                    className="ml-auto flex h-8.5 items-center gap-1.5 rounded-[9px] bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover"
                  >
                    <UserPlus className="size-3.5" />
                    멤버 초대
                  </Link>
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

              <PendingMembersCard />
            </>
          )}

          {activeTab === "company" && <CompanyInfoCard />}

          {activeTab === "integration" && (
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
          {canSave
            ? "저장하지 않은 변경 사항이 있습니다"
            : "로그인 시 변경 사항이 Firestore 에 저장됩니다"}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setEdits({})}
            className="h-9 rounded-[9px] border border-[#475569] px-3.5 text-[13px] font-semibold text-slate-200"
          >
            취소
          </button>
          <button
            onClick={commit}
            disabled={edits.saving}
            className="h-9 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {edits.saving ? "저장 중…" : "변경사항 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompanyInfoCard() {
  const { data, loading, save } = useWorkspace();
  const [edits, setEdits] = React.useState<Partial<typeof data>>({});
  const [saving, setSaving] = React.useState(false);
  const dirty = Object.keys(edits).length > 0;
  const values = { ...data, ...edits };

  const commit = async () => {
    setSaving(true);
    await save(edits);
    setEdits({});
    setSaving(false);
  };

  return (
    <GwCard className="flex flex-col gap-4.5 p-5.5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-[14.5px] font-semibold tracking-[-0.015em]">
            회사 정보
          </h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            전자결재 문서와 사내 안내에 표시되는 기본 정보입니다.
          </p>
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
        {WORKSPACE_FIELD_LABELS.map((f) => (
          <Field key={f.key} label={f.label}>
            <input
              value={values[f.key]}
              onChange={(e) =>
                setEdits((p) => ({ ...p, [f.key]: e.target.value }))
              }
              placeholder={f.placeholder}
              className={fieldInput}
            />
          </Field>
        ))}
      </div>
      {dirty && (
        <div className="flex justify-end gap-2 border-t border-[#f1f5f9] pt-4">
          <button
            onClick={() => setEdits({})}
            className="h-9 rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-semibold text-secondary-foreground hover:bg-secondary"
          >
            취소
          </button>
          <button
            onClick={commit}
            disabled={saving}
            className="h-9 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {saving ? "저장 중…" : "회사 정보 저장"}
          </button>
        </div>
      )}
    </GwCard>
  );
}

function PendingMembersCard() {
  const { data, loading, approve, reject } = usePendingUsers();
  const [busy, setBusy] = React.useState<string | null>(null);

  const act = async (uid: string, fn: (uid: string) => Promise<void>) => {
    setBusy(uid);
    await fn(uid);
    setBusy(null);
  };

  return (
    <GwCard>
      <div className="flex items-center gap-2 border-b border-[#eef1f5] px-5 py-4">
        <h3 className="text-sm font-semibold tracking-[-0.015em]">
          승인 대기 계정
        </h3>
        <span
          className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold text-[#c2410c]"
          style={{ background: "#fff7ed" }}
        >
          {loading ? "확인 중…" : `${data.length}건 대기`}
        </span>
      </div>
      {!loading && data.length === 0 && (
        <div className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
          승인 대기 중인 계정이 없습니다.
        </div>
      )}
      {data.map((m) => (
        <div
          key={m.uid}
          className="flex flex-wrap items-center gap-3 border-b border-[#f1f5f9] px-5 py-3.5"
        >
          <span style={avatarStyle(m.name.charAt(0), 36)}>
            {m.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-[1_1_180px]">
            <div className="text-[13px] font-semibold">
              {m.name}{" "}
              <span className="font-normal text-muted-foreground">
                {m.position}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
              {m.email} · {m.departmentId || "부서 미배정"}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => act(m.uid, reject)}
              disabled={busy === m.uid}
              className="h-8 rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-60"
            >
              거절
            </button>
            <button
              onClick={() => act(m.uid, approve)}
              disabled={busy === m.uid}
              className="h-8 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              승인
            </button>
          </div>
        </div>
      ))}
    </GwCard>
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
