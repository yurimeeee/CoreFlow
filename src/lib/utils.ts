import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extracts a lowercase file extension, defaulting to "png". */
export function fileExt(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : "png";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 로컬 달력 날짜를 "YYYY-MM-DD"로 반환 — `Date#toISOString().slice(0, 10)`은
 * UTC 기준이라, UTC+9(KST)에서는 자정~오전 9시 사이에 하루 전 날짜로
 * 밀립니다(예: KST 07:00 체크인이 전날로 기록됨). 항상 로컬 달력 기준
 * 필드(출퇴근·예약·연차 등)에는 이 함수를 써야 합니다.
 */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
