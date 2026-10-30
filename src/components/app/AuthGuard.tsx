"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock, Crown, Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";
import { isTwoFactorVerified } from "@/lib/twoFactorSession";

/**
 * (app) 워크스페이스 인증 가드.
 * - Firebase 미설정: 데모 모드로 그냥 렌더
 * - 로그인 안 됨: /login 으로 리다이렉트
 * - 2FA 등록되어 있지만 이번 세션에서 아직 코드 확인을 안 함: /login 으로
 *   되돌려 보내 코드 입력을 다시 요구 (LoginForm 이 currentUser 를 보고
 *   비밀번호 입력 없이 바로 2FA 단계를 띄워줍니다)
 * - 로그인은 됐지만 구성원(users 문서 status == ACTIVE)이 아님: 안내 화면.
 *   Firestore 규칙이 공용 데이터를 ACTIVE 구성원에게만 열어 주므로, 그대로
 *   앱을 렌더하면 모든 화면이 권한 오류로 비어 보입니다.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authUser, profile, loading, logout } = useAuthUser();

  // 실제 비밀키는 users/{uid}가 아니라 본인만 읽을 수 있는 userSecrets/{uid}에
  // 있어 여기서는 조회하지 않습니다 — enroll()이 항상 두 문서를 함께 쓰므로
  // (useTwoFactor 참고) gwSettings.twoFA가 true면 비밀키도 반드시 존재합니다.
  const needsTwoFactor =
    !!authUser && !!profile?.gwSettings?.twoFA && !isTwoFactorVerified(authUser.uid);

  const allowed = !isFirebaseConfigured || (!!authUser && !needsTwoFactor);

  React.useEffect(() => {
    if (!isFirebaseConfigured || loading) return;
    if (!authUser || needsTwoFactor) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
    }
  }, [loading, authUser, needsTwoFactor, pathname, router]);

  if (isFirebaseConfigured && (loading || !authUser || needsTwoFactor)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isFirebaseConfigured && profile?.status !== "ACTIVE") {
    return <NotMember status={profile?.status ?? null} onLogout={logout} />;
  }

  return allowed ? <>{children}</> : null;
}

function NotMember({
  status,
  onLogout,
}: {
  status: string | null;
  onLogout: () => Promise<void>;
}) {
  const pending = status === "PENDING";
  const Icon = pending ? Clock : ShieldOff;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Icon className="size-6" />
        </div>
        <h2 className="mt-5 text-xl font-bold tracking-[-0.02em]">
          {pending
            ? "관리자 승인을 기다리고 있습니다"
            : status === "SUSPENDED"
              ? "사용이 중지된 계정입니다"
              : "워크스페이스 구성원이 아닙니다"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {pending
            ? "승인이 완료되면 바로 이용할 수 있습니다. 승인 후 다시 로그인해 주세요."
            : "초대받은 계정으로 로그인했는지 확인하거나 관리자에게 문의해 주세요."}
        </p>
        {status === null && <BootstrapAdmin />}
        <Button variant="outline" className="mt-6" onClick={() => onLogout()}>
          로그아웃
        </Button>
      </div>
    </div>
  );
}

/**
 * users 문서가 아예 없는 계정 — 빈 프로젝트의 첫 관리자일 수 있습니다.
 * 서버(/api/admin/bootstrap)가 BOOTSTRAP_ADMIN_EMAIL 과 일치하고 관리자가
 * 아직 없다고 답할 때만 버튼을 보여 줍니다. 생성되면 useAuthUser 의 프로필
 * 구독이 ACTIVE 를 받아 그대로 앱으로 들어갑니다.
 */
function BootstrapAdmin() {
  const [available, setAvailable] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const call = React.useCallback(async (method: "GET" | "POST") => {
    const token = await firebaseAuth().currentUser?.getIdToken();
    if (!token) return null;
    const res = await fetch("/api/admin/bootstrap", {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    return (await res.json().catch(() => null)) as
      | { ok: boolean; available?: boolean; error?: string }
      | null;
  }, []);

  React.useEffect(() => {
    let alive = true;
    call("GET")
      .then((r) => alive && setAvailable(!!r?.ok && !!r.available))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [call]);

  if (!available) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    const r = await call("POST").catch(() => null);
    if (!r?.ok) {
      setError(
        r?.error === "already_bootstrapped"
          ? "이미 관리자가 있습니다. 관리자에게 초대를 요청해 주세요."
          : "첫 관리자 설정에 실패했습니다.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 w-full rounded-[var(--radius-md)] border border-border bg-secondary/60 p-4 text-left">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        아직 관리자가 없는 워크스페이스입니다. 이 계정을 첫 최고 관리자로 설정할 수 있습니다.
      </p>
      {error && <p className="mt-2 text-[13px] font-medium text-destructive">{error}</p>}
      <Button className="mt-3 w-full" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Crown />}
        첫 관리자로 시작하기
      </Button>
    </div>
  );
}
