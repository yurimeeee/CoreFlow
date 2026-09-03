import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  FileCheck2,
  FolderKanban,
  Network,
  Waypoints,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: CalendarClock,
    title: "출퇴근 기록",
    desc: "GPS·QR 기반 근태 체크와 자동 집계로 근무시간을 투명하게 관리합니다.",
  },
  {
    icon: FileCheck2,
    title: "전자결재",
    desc: "서명·직인 이미지를 등록해 결재 문서를 끊김 없이 처리합니다.",
  },
  {
    icon: FolderKanban,
    title: "프로젝트 관리",
    desc: "담당 업무 키워드로 팀과 작업을 연결하고 진행률을 한눈에 봅니다.",
  },
  {
    icon: Network,
    title: "조직도",
    desc: "부서·직급·담당 업무가 실시간으로 반영되는 살아있는 조직도.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">로그인</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">
              회원가입
              <ArrowRight />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[13px] font-semibold text-muted-foreground">
              <Waypoints className="size-3.5 text-primary" />
              B2B 그룹웨어
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.15] tracking-[-0.04em] sm:text-5xl">
              모든 업무의 중심을 잇다
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              출퇴근 기록부터 전자결재, 프로젝트 관리, 조직도까지 — 파편화된
              기업의 핵심 업무(Core)를 끊김 없는 하나의 흐름(Flow)으로 완벽하게
              연결합니다.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">
                  초대 링크로 시작하기
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">로그인</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-[var(--radius-lg)] border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                <span className="flex size-10 items-center justify-center rounded-[10px] bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-[15px] font-bold tracking-[-0.02em]">
                  {title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} CoreFlow · 모든 업무의 중심을 잇다
        </div>
      </footer>
    </div>
  );
}
