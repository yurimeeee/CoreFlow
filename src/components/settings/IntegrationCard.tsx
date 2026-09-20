"use client";

import * as React from "react";
import { X } from "lucide-react";
import { pill } from "@/lib/groupware/ui";

/**
 * 연동 카드 공통 쉘 — 아이콘 · 이름 · 연동 상태 pill · 우측 액션(버튼/안내
 * 문구) · 하단 본문 · 에러 메시지 레이아웃을 모든 연동 카드(Webhook,
 * Google Calendar, Google Drive, …)가 공유합니다. 본문(children)은 카드마다
 * 달라서(URL 입력 폼, 일정/파일 목록 등) 그대로 각 카드에 남습니다.
 */
export function IntegrationCard({
  icon: Icon,
  iconBg,
  iconColor,
  name,
  connected,
  statusLabel,
  action,
  error,
  children,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  name: string;
  connected: boolean;
  statusLabel: React.ReactNode;
  action: React.ReactNode;
  error?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-[#f1f5f9] py-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <span
          className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: iconBg }}
        >
          <Icon className="size-4" style={{ color: iconColor }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold">{name}</span>
            <span style={pill(connected ? "#f0fdf4" : "#f1f5f9", connected ? "#15803d" : "#94a3b8")}>
              {connected ? "연동됨" : "미연동"}
            </span>
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{statusLabel}</div>
        </div>
        {action}
      </div>

      {children}

      {error && (
        <p
          role="alert"
          className="flex items-center gap-1.5 pl-[46px] text-[12px] font-medium text-destructive"
        >
          <X className="size-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

/** 카드 우측 상단의 연동/해제 버튼 — Webhook·Calendar·Drive 카드가 공유. */
export function IntegrationConnectButton({
  connected,
  busy,
  disabled,
  onClick,
  connectedLabel = "연동 해제",
  disconnectedLabel = "연동하기",
  busyIcon,
}: {
  connected: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  connectedLabel?: React.ReactNode;
  disconnectedLabel?: React.ReactNode;
  busyIcon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className={
        connected
          ? "h-8 shrink-0 whitespace-nowrap rounded-lg border border-border bg-card px-3.5 text-[12.5px] font-semibold text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          : "h-8 shrink-0 whitespace-nowrap rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {connected ? connectedLabel : busy ? busyIcon : disconnectedLabel}
    </button>
  );
}
