"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";
import { isTwoFactorVerified } from "@/lib/twoFactorSession";

/**
 * (app) 워크스페이스 인증 가드.
 * - Firebase 미설정: 데모 모드로 그냥 렌더
 * - 로그인 안 됨: /login 으로 리다이렉트
 * - 2FA 등록되어 있지만 이번 세션에서 아직 코드 확인을 안 함: /login 으로
 *   되돌려 보내 코드 입력을 다시 요구 (LoginForm 이 currentUser 를 보고
 *   비밀번호 입력 없이 바로 2FA 단계를 띄워줍니다)
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authUser, profile, loading } = useAuthUser();

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

  return allowed ? <>{children}</> : null;
}
