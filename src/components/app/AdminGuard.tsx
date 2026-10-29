"use client";

import * as React from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Forbidden } from "@/components/app/Forbidden";

/**
 * /admin/* 관리자 콘솔 가드 — AuthGuard(로그인·2FA·구성원 확인) 위에
 * 관리자(ADMIN·SUPER_ADMIN) 여부를 추가로 확인합니다. 예전엔 각 페이지가
 * "role이 MEMBER면 차단"만 해서, 프로필이 없거나 승인 대기인 계정에도
 * 화면이 열렸고 /admin/seed 는 가드 자체가 없었습니다. 실제 쓰기 권한은
 * firestore.rules 의 isAdmin() 이 최종 판정합니다.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminOnly>{children}</AdminOnly>
    </AuthGuard>
  );
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthUser();
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  if (!isFirebaseConfigured || isAdmin) return <>{children}</>;

  return (
    <Forbidden
      title="관리자 전용 화면입니다"
      desc="이 화면은 관리자 권한이 필요합니다. 권한이 필요하면 워크스페이스 관리자에게 상향을 요청하세요."
      requestLabel="관리자 권한 요청하기"
      rows={[
        {
          tint: ["#f1f5f9", "#64748b"],
          label: "내 역할",
          value: `${profile?.name ?? ""} · Member`,
          state: "현재",
          statePill: ["#f1f5f9", "#475569"],
        },
        {
          tint: ["#fef2f2", "#dc2626"],
          label: "필요 권한",
          value: "Admin 이상",
          state: "미충족",
          statePill: ["#fef2f2", "#b91c1c"],
        },
      ]}
    />
  );
}
