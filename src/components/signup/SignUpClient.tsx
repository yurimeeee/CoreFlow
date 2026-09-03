"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignUpWizard } from "./SignUpWizard";
import { useInvite } from "@/hooks/useInvite";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "최고 관리자",
  ADMIN: "관리자",
  MEMBER: "일반 멤버",
};

export function SignUpClient() {
  const params = useSearchParams();
  const token = params.get("token");
  const inviteState = useInvite(token);

  return (
    <AuthShell
      eyebrow="CoreFlow 회원가입"
      title="초대받은 계정으로 가입하기"
      subtitle="관리자가 발급한 초대 링크를 통해 3단계로 간편하게 가입합니다."
      footer={
        <>
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <Card>
        <CardContent className="p-6 sm:p-8">
          {inviteState.isLoading && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm">초대 정보를 확인하는 중…</p>
            </div>
          )}

          {!inviteState.isLoading && !inviteState.isValid && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-7" />
              </span>
              <div>
                <h2 className="text-lg font-bold">초대를 확인할 수 없습니다</h2>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                  {inviteState.error}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {(inviteState.status === "error" ||
                  inviteState.status === "not-found") && (
                  <Button variant="outline" onClick={() => inviteState.retry()}>
                    <RefreshCw />
                    다시 시도
                  </Button>
                )}
                <Button asChild variant="ghost">
                  <Link href="/login">
                    로그인 화면으로
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {inviteState.isValid && inviteState.invite && (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-secondary/70 px-3.5 py-3 text-[13px]">
                <span className="font-semibold text-secondary-foreground">
                  {inviteState.invite.email}
                </span>
                <Badge variant="soft">
                  {ROLE_LABEL[inviteState.invite.role] ?? inviteState.invite.role}
                </Badge>
                {inviteState.invite.requireApproval && (
                  <Badge variant="warning">관리자 승인 필요</Badge>
                )}
                {inviteState.invite.invitedByName && (
                  <span className="text-muted-foreground">
                    · {inviteState.invite.invitedByName} 님이 초대
                  </span>
                )}
              </div>
              <SignUpWizard invite={inviteState.invite} />
            </>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
