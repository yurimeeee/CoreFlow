"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Hash,
  LogOut,
  Mail,
  Phone,
  ShieldAlert,
} from "lucide-react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Timestamp } from "firebase/firestore";

function fmtDate(v: Timestamp | Date | undefined): string {
  if (!v) return "—";
  const d = "toDate" in v ? v.toDate() : v;
  return d.toLocaleDateString("ko-KR");
}

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  ACTIVE: { label: "활성", variant: "success" },
  PENDING: { label: "승인 대기", variant: "warning" },
  INVITED: { label: "초대됨", variant: "outline" },
  SUSPENDED: { label: "정지", variant: "outline" },
};

export default function DashboardPage() {
  const router = useRouter();
  const { authUser, profile, loading, logout } = useAuthUser();

  React.useEffect(() => {
    if (!loading && !authUser) router.replace("/login");
  }, [loading, authUser, router]);

  if (loading || !authUser) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }

  const status = profile ? STATUS[profile.status] : undefined;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-15 max-w-5xl items-center justify-between px-5 py-3">
          <Link href="/">
            <Logo />
          </Link>
          <Button variant="outline" size="sm" onClick={() => logout()}>
            <LogOut />
            로그아웃
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        {profile?.status === "PENDING" && (
          <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-warning/30 bg-warning/5 p-4 text-[13px] text-[#b45309]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            관리자 승인 대기 중입니다. 승인이 완료되면 모든 기능을 사용할 수
            있습니다.
          </div>
        )}

        <div className="flex items-center gap-4">
          {profile?.profileImageUrl ? (
            <span className="relative size-16 overflow-hidden rounded-full ring-4 ring-card shadow-[var(--shadow-card)]">
              <Image
                src={profile.profileImageUrl}
                alt={profile.name}
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            </span>
          ) : (
            <span className="flex size-16 items-center justify-center rounded-full bg-accent text-xl font-bold text-primary">
              {(profile?.name ?? authUser.email ?? "U").charAt(0)}
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-[-0.02em]">
                {profile?.name ?? "이름 미설정"}
              </h1>
              {status && <Badge variant={status.variant}>{status.label}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {profile?.position ?? "—"} · {profile?.role ?? "MEMBER"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <InfoCard icon={Mail} label="이메일" value={profile?.email ?? authUser.email ?? "—"} />
          <InfoCard icon={Hash} label="사번" value={profile?.employeeId ?? "—"} />
          <InfoCard icon={Building2} label="부서" value={profile?.departmentId ?? "—"} />
          <InfoCard icon={Phone} label="휴대폰" value={profile?.phone ?? "—"} />
          <InfoCard icon={CalendarClock} label="입사일" value={fmtDate(profile?.joinedAt)} />
          <InfoCard
            icon={Phone}
            label="내선번호"
            value={profile?.extensionNumber || "—"}
          />
        </div>

        {profile?.tasks && profile.tasks.length > 0 && (
          <Card className="mt-4">
            <CardContent className="flex flex-wrap items-center gap-2 p-5">
              <span className="mr-1 text-[13px] font-semibold text-secondary-foreground">
                담당 업무
              </span>
              {profile.tasks.map((t) => (
                <Badge key={t} variant="soft">
                  {t}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {profile?.signatureUrl && (
          <Card className="mt-4">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-secondary-foreground">
                <BadgeCheck className="size-4 text-primary" />
                전자결재 서명
              </div>
              <span className="relative block h-24 w-full max-w-[280px] overflow-hidden rounded-md border border-border bg-card">
                <Image
                  src={profile.signatureUrl}
                  alt="서명"
                  fill
                  sizes="280px"
                  className="object-contain p-2"
                  unoptimized
                />
              </span>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold text-secondary-foreground">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
