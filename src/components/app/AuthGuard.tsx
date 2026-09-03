"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";

/**
 * (app) 워크스페이스 인증 가드.
 * - Firebase 미설정: 데모 모드로 그냥 렌더
 * - 로그인 안 됨: /login 으로 리다이렉트
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { authUser, loading } = useAuthUser();

  const allowed = !isFirebaseConfigured || !!authUser;

  React.useEffect(() => {
    if (isFirebaseConfigured && !loading && !authUser) {
      router.replace("/login?next=/dashboard");
    }
  }, [loading, authUser, router]);

  if (isFirebaseConfigured && (loading || !authUser)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return allowed ? <>{children}</> : null;
}
