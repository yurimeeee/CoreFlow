"use client";

import * as React from "react";
import {
  getThemeMode,
  resolveThemeMode,
  setThemeMode,
  subscribeThemeMode,
  type ThemeMode,
} from "@/lib/theme";

/** 헤더 토글·설정 화면이 공유하는 다크 모드 상태 (둘 다 항상 동시에 마운트돼 있어 동기화가 필요합니다). */
export function useThemeMode() {
  const mode = React.useSyncExternalStore(
    subscribeThemeMode,
    getThemeMode,
    () => "system" as ThemeMode,
  );
  return { mode, resolved: resolveThemeMode(mode), setMode: setThemeMode };
}
