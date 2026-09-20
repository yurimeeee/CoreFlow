"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { Copy, Link2, Loader2, Send, Sparkles } from "lucide-react";
import { firebaseAuth, firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useOrgPeople, useTeams } from "@/lib/groupware/hooks";
import { PositionSelect } from "@/components/app/PositionSelect";
import { AuthShell } from "@/components/layout/AuthShell";
import { Forbidden } from "@/components/app/Forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/signup/Field";
import type { UserRole } from "@/types/user";

/**
 * ⚠️ 데모/부트스트랩용 화면입니다.
 * 실제 운영에서는 관리자 인증 + 서버(Admin SDK) 또는 Firestore 보안 규칙으로 보호하세요.
 */
export default function AdminInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <AdminInviteClient />
    </Suspense>
  );
}

function AdminInviteClient() {
  const { profile } = useAuthUser();
  const { teams } = useTeams();
  const { people } = useOrgPeople();
  const searchParams = useSearchParams();
  const fromPlaceholder = searchParams.get("fromPlaceholder");

  const [form, setForm] = React.useState({
    email: "",
    employeeId: "",
    teamId: "",
    managerId: "",
    position: "",
    role: "MEMBER" as UserRole,
    requireApproval: true,
    expiresInDays: 7,
  });
  const [loading, setLoading] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // 가계정 프로필에서 "초대 링크 만들기"로 들어온 경우 이름·팀·상사를 기본값으로 미리 보여줌
  // (아직 직접 입력을 안 건드린 필드에 한해 — people 은 비동기로 로드되므로 폼 상태에
  // 동기화하는 대신 읽을 때 폴백으로 사용)
  const placeholder = fromPlaceholder
    ? people.find((p) => p.id === fromPlaceholder)
    : undefined;
  const teamIdValue = form.teamId || placeholder?.teamId || "";
  const managerIdValue = form.managerId || placeholder?.boss || "";
  const positionValue = form.position || placeholder?.role || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLink(null);
    if (!isFirebaseConfigured) {
      setError("Firebase 환경변수가 설정되지 않았습니다. (.env.local 확인)");
      return;
    }
    setLoading(true);
    try {
      // Firebase Auth 초기 세션 복원이 끝날 때까지 대기 — 그전에 쓰기를
      // 보내면 Firestore 규칙이 request.auth 를 null 로 보고 거부합니다.
      await firebaseAuth().authStateReady();
      if (!firebaseAuth().currentUser) {
        setError("로그인 세션을 확인할 수 없습니다. 다시 로그인한 뒤 시도해 주세요.");
        setLoading(false);
        return;
      }
      const token = crypto.randomUUID().replace(/-/g, "");
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + form.expiresInDays * 86_400_000),
      );
      const teamName = teams.find((t) => t.id === teamIdValue)?.name ?? "";
      await addDoc(collection(firebaseDb(), "invites"), {
        token,
        email: form.email.trim().toLowerCase(),
        employeeId: form.employeeId.trim(),
        teamId: teamIdValue || null,
        teamName,
        managerId: managerIdValue || null,
        position: positionValue.trim(),
        role: form.role,
        status: "INVITED",
        requireApproval: form.requireApproval,
        invitedBy: "admin-console",
        invitedByName: "관리자",
        createdAt: serverTimestamp(),
        expiresAt,
        completedUid: null,
        completedAt: null,
      });
      setLink(`${window.location.origin}/signup?token=${token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "초대 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (isFirebaseConfigured && profile?.role === "MEMBER") {
    return (
      <Forbidden
        title="관리자 전용 화면입니다"
        desc="초대 링크 발급은 관리자 권한이 필요합니다. 권한이 필요하면 워크스페이스 관리자에게 상향을 요청하세요."
        requestLabel="관리자 권한 요청하기"
        rows={[
          {
            tint: ["#f1f5f9", "#64748b"],
            label: "내 역할",
            value: `${profile.name} · Member`,
            state: "현재",
            statePill: ["#f1f5f9", "#475569"],
          },
          {
            tint: ["#fef2f2", "#dc2626"],
            label: "필요 권한",
            value: "Admin 이상 · 멤버 초대",
            state: "미충족",
            statePill: ["#fef2f2", "#b91c1c"],
          },
        ]}
      />
    );
  }

  return (
    <AuthShell
      eyebrow="관리자 콘솔 · 데모"
      title="초대 링크 발급"
      subtitle="가입자가 Read-only 로 확인할 조직 정보를 미리 입력합니다."
    >
      <Card>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="i-email" label="회사 이메일" required>
                <Input
                  id="i-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => upd("email", e.target.value)}
                  placeholder="member@company.com"
                  required
                />
              </Field>
              <Field id="i-emp" label="사번" required>
                <Input
                  id="i-emp"
                  value={form.employeeId}
                  onChange={(e) => upd("employeeId", e.target.value)}
                  placeholder="CF-2026-014"
                  required
                />
              </Field>
              <Field id="i-team" label="소속 팀">
                <select
                  id="i-team"
                  value={teamIdValue}
                  onChange={(e) => upd("teamId", e.target.value)}
                  className="h-11 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="">미배정</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="i-manager" label="직속 상사">
                <select
                  id="i-manager"
                  value={managerIdValue}
                  onChange={(e) => upd("managerId", e.target.value)}
                  className="h-11 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="">없음 (최상위)</option>
                  {people
                    .filter((p) => !p.placeholder)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.role}
                      </option>
                    ))}
                </select>
              </Field>
              <Field id="i-pos" label="직급 / 직책" required>
                <PositionSelect
                  id="i-pos"
                  value={positionValue}
                  onChange={(v) => upd("position", v)}
                  required
                  className="h-11 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </Field>
              <Field id="i-role" label="권한">
                <select
                  id="i-role"
                  value={form.role}
                  onChange={(e) => upd("role", e.target.value as UserRole)}
                  className="h-11 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="MEMBER">일반 멤버</option>
                  <option value="ADMIN">관리자</option>
                  <option value="SUPER_ADMIN">최고 관리자</option>
                </select>
              </Field>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] border border-input p-3 text-[13px]">
              <input
                type="checkbox"
                checked={form.requireApproval}
                onChange={(e) => upd("requireApproval", e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              가입 완료 후 관리자 승인 필요 (status = PENDING)
            </label>

            {error && (
              <p className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[13px] font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Send />}
              초대 링크 생성
            </Button>
          </form>

          {link && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-accent-foreground/20 bg-accent/40 p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-accent-foreground">
                <Sparkles className="size-4" />
                초대 링크가 생성되었습니다
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2">
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-mono text-xs">{link}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-accent"
                >
                  <Copy className="size-3.5" />
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              <Link
                href={link.replace(window.location.origin, "")}
                className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
              >
                이 링크로 가입 화면 열기 →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
