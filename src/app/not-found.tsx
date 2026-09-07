"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, FileSearch, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <div className="animate-step flex w-full max-w-[560px] flex-col items-center text-center">
        <div className="relative flex items-center justify-center">
          <div className="text-[116px] font-extrabold leading-none tracking-[-0.06em] text-[#e2e8f0]">
            404
          </div>
          <div className="absolute flex size-[62px] items-center justify-center rounded-[18px] border border-border bg-card shadow-[0_10px_26px_rgba(15,23,42,0.1)]">
            <FileSearch className="size-[26px] text-primary" />
          </div>
        </div>

        <h1 className="mt-6 text-[23px] font-bold tracking-[-0.03em]">
          문서가 이 결재선을 타지 않았습니다
        </h1>
        <p className="mt-2.5 max-w-[400px] text-pretty text-[13px] leading-[1.75] text-muted-foreground">
          요청한 주소를 찾을 수 없습니다. 링크가 만료되었거나, 문서가 이동 또는
          삭제되었을 수 있습니다.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard"
            className="flex h-10 items-center gap-1.5 rounded-[10px] bg-primary pl-3 pr-4 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] transition-colors hover:bg-primary-hover active:translate-y-px"
          >
            <LayoutDashboard className="size-4" />
            대시보드로 이동
          </Link>
          <button
            onClick={() => router.back()}
            className="flex h-10 items-center gap-1.5 rounded-[10px] border border-border bg-card pl-3 pr-4 text-[13px] font-semibold text-secondary-foreground transition-colors hover:border-ring hover:bg-secondary"
          >
            <ArrowLeft className="size-4" />
            이전 화면
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {pathname}
          </span>
          <span className="h-3.5 w-px bg-border" />
          <span className="text-[11.5px] text-muted-foreground">ERR-404</span>
        </div>
      </div>
    </div>
  );
}
