"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** 조직 전반에서 공통으로 쓰는 직급 체계 — 자유 입력 대신 여기서 선택 */
export const POSITION_LEVELS = [
  "사원",
  "주임",
  "대리",
  "과장",
  "차장",
  "부장",
  "파트장",
  "팀장",
  "본부장",
  "이사",
  "상무",
  "전무",
  "부사장",
  "대표이사",
];

const CUSTOM = "__custom__";

export function PositionSelect({
  id,
  value,
  onChange,
  className,
  required,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
  required?: boolean;
}) {
  const isCustom = value !== "" && !POSITION_LEVELS.includes(value);
  const [custom, setCustom] = React.useState(isCustom);

  return (
    <div className="flex flex-col gap-1.5">
      <select
        id={id}
        value={custom ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
        required={required}
        className={className}
      >
        <option value="" disabled>
          직급 선택
        </option>
        {POSITION_LEVELS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value={CUSTOM}>직접 입력…</option>
      </select>
      {custom && (
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="직급을 입력하세요 (예: CTO)"
          required={required}
          className={cn(className, "mt-0.5")}
        />
      )}
    </div>
  );
}
