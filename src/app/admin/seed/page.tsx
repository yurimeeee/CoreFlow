"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Database, Loader2, TriangleAlert } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";
import { runSeed } from "@/lib/groupware/hooks";
import { buildSeed } from "@/lib/groupware/firestore";
import { AuthShell } from "@/components/layout/AuthShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * ⚠️ 데모/부트스트랩용 — 그룹웨어 목 데이터를 Firestore 로 1회 시드합니다.
 * (임직원 · 공지 · Task · 전자결재). 이미 존재하면 merge 로 덮어씁니다.
 */
export default function SeedPage() {
  const { authUser, loading } = useAuthUser();
  const [state, setState] = React.useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [error, setError] = React.useState<string | null>(null);

  const total = buildSeed().length;

  const seed = async () => {
    setState("running");
    setError(null);
    setProgress({ done: 0, total });
    try {
      await runSeed(
        authUser
          ? {
              uid: authUser.uid,
              email: authUser.email,
              name: authUser.displayName,
            }
          : null,
        (done, t) => setProgress({ done, total: t }),
      );
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "시드 실패");
      setState("error");
    }
  };

  return (
    <AuthShell
      eyebrow="관리자 콘솔 · 데모"
      title="그룹웨어 데이터 시드"
      subtitle="임직원 디렉토리 · 공지사항 · 프로젝트 Task · 전자결재 문서를 Firestore 에 채웁니다."
    >
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:p-8">
          {!isFirebaseConfigured && (
            <p className="flex items-center gap-2 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[13px] font-medium text-destructive">
              <TriangleAlert className="size-4" />
              Firebase 환경변수가 설정되지 않았습니다. (.env.local 확인)
            </p>
          )}

          {isFirebaseConfigured && !loading && !authUser && (
            <p className="flex items-center gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 px-3.5 py-3 text-[13px] font-medium text-[#b45309]">
              <TriangleAlert className="size-4" />
              로그인 후 이용할 수 있습니다.{" "}
              <Link href="/login" className="underline">
                로그인
              </Link>
            </p>
          )}

          <div className="rounded-[var(--radius-md)] bg-secondary px-3.5 py-3 text-[13px] text-muted-foreground">
            총 <b className="text-secondary-foreground">{total}개</b> 문서 ·
            컬렉션 <code className="font-mono text-xs">orgPeople</code>{" "}
            <code className="font-mono text-xs">notices</code>{" "}
            <code className="font-mono text-xs">tasks</code>{" "}
            <code className="font-mono text-xs">approvals</code>
          </div>

          {state === "running" && (
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-primary">
                <Loader2 className="size-4 animate-spin" />
                시드 중… {progress.done} / {progress.total}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {state === "done" && (
            <p className="flex items-center gap-2 rounded-[var(--radius-md)] border border-success/30 bg-success/5 px-3.5 py-3 text-[13px] font-medium text-success">
              <CheckCircle2 className="size-4" />
              {progress.done}개 문서를 시드했습니다.
            </p>
          )}

          {error && (
            <p className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[13px] font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={seed}
              disabled={
                !isFirebaseConfigured || !authUser || state === "running"
              }
            >
              {state === "running" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Database />
              )}
              {state === "done" ? "다시 시드" : "시드 실행"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">워크스페이스로</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
