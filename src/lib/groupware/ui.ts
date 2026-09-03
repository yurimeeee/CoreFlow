import type { CSSProperties } from "react";
import { STATUS_META, type PersonStatus } from "./data";

/** 라운드 pill 배지 스타일 (배경/글자색 지정) */
export function pill(bg: string, fg: string): CSSProperties {
  return {
    fontSize: "10.5px",
    fontWeight: 650,
    letterSpacing: "0.01em",
    padding: "3px 7px",
    borderRadius: 6,
    whiteSpace: "nowrap",
    background: bg,
    color: fg,
    display: "inline-block",
  };
}

const AVATAR_PALETTE: Record<string, string> = {
  김: "#4f46e5", 정: "#0f766e", 박: "#b45309", 이: "#7c3aed", 최: "#be123c",
  한: "#0e7490", 강: "#b91c1c", 오: "#6d28d9", 배: "#334155", 문: "#be185d",
  서: "#1d4ed8", 신: "#15803d", 노: "#4f46e5", 윤: "#7c3aed", 조: "#c2410c",
};

export function avatarStyle(initial: string, size: number): CSSProperties {
  return {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    borderRadius: 999,
    background: AVATAR_PALETTE[initial] ?? "#64748b",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size <= 22 ? 10 : size <= 34 ? 11 : Math.round(size / 2.9),
    fontWeight: 650,
    letterSpacing: "-0.01em",
  };
}

export function ddayStyle(dday: string): CSSProperties {
  const c =
    dday === "완료"
      ? ["#f1f5f9", "#94a3b8"]
      : dday.startsWith("D+")
        ? ["#fef2f2", "#b91c1c"]
        : dday === "D-Day"
          ? ["#4f46e5", "#ffffff"]
          : ["#eef2ff", "#4338ca"];
  return {
    fontSize: "10.5px",
    fontWeight: 700,
    padding: "3px 7px",
    borderRadius: 6,
    whiteSpace: "nowrap",
    background: c[0],
    color: c[1],
  };
}

export function statusDot(status: PersonStatus, size: number, ring: number): CSSProperties {
  return {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: size,
    height: size,
    borderRadius: 999,
    background: STATUS_META[status].color,
    border: `${ring}px solid #fff`,
  };
}

export function statusPill(status: PersonStatus): CSSProperties {
  const m = STATUS_META[status];
  return pill(m.pillBg, m.pillFg);
}
