"use client";

import { useSyncExternalStore } from "react";

/**
 * 1초마다 갱신되는 현재 시각.
 *
 * getSnapshot 은 반드시 안정적인 값을 반환해야 하므로(매 호출마다 Date.now()
 * 를 새로 반환하면 무한 렌더 루프가 발생) 모듈 레벨에 캐시된 스냅샷을 두고
 * 타이머 tick 에서만 갱신합니다.
 */
let snapshot = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  snapshot = Date.now();
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!timer) timer = setInterval(tick, 1000);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => 0;

export function useNow(): Date | null {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ms ? new Date(ms) : null;
}
