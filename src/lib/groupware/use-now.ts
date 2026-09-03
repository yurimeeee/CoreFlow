"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};

/**
 * 1초마다 갱신되는 현재 시각. 서버 스냅샷은 null 이라 하이드레이션 불일치가 없습니다.
 */
export function useNow(): Date | null {
  const ms = useSyncExternalStore(
    subscribe,
    () => Date.now(),
    () => 0,
  );
  return ms ? new Date(ms) : null;
}
