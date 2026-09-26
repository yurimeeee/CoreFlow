"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/hooks/useThemeMode";

/** 헤더 아이콘 버튼 — 라이트 ↔ 다크 즉시 전환. 시스템 설정 연동은 설정 > 내 프로필에서. */
export function ThemeToggle() {
  const { resolved, setMode } = useThemeMode();
  const isDark = resolved === "dark";

  return (
    <button
      onClick={() => setMode(isDark ? "light" : "dark")}
      className="flex size-9 items-center justify-center rounded-[9px] text-secondary-foreground transition-colors hover:bg-secondary"
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
