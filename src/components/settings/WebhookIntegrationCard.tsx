"use client";

import * as React from "react";
import { Check, Loader2, Send, X } from "lucide-react";
import { sendTestNotification } from "@/lib/integrations/notify";
import type { WorkspaceWebhookIntegration } from "@/lib/groupware/firestore";
import { cn } from "@/lib/utils";
import { pill } from "@/lib/groupware/ui";

const fieldInput =
  "h-9 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

/**
 * Slack / Jandi Incoming Webhook 연동 카드.
 * URL 저장 → on/off 토글 → 테스트 메시지 발송까지 실제로 동작합니다.
 */
export function WebhookIntegrationCard({
  service,
  name,
  desc,
  icon: Icon,
  bg,
  color,
  value,
  onSave,
  helpHref,
}: {
  service: "slack" | "jandi";
  name: string;
  desc: string;
  icon: React.ElementType;
  bg: string;
  color: string;
  value: WorkspaceWebhookIntegration | undefined;
  onSave: (patch: WorkspaceWebhookIntegration) => Promise<void>;
  helpHref: string;
}) {
  const savedUrl = value?.webhookUrl ?? "";
  const [url, setUrl] = React.useState(savedUrl);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<"ok" | "fail" | null>(null);

  // Firestore 에서 savedUrl 이 바뀌면(다른 세션 저장 등) 편집 중이 아닌 로컬
  // 입력값도 따라가도록 렌더 중에 동기화합니다 (React 공식 "prop이 바뀌면
  // state 조정" 패턴 — effect가 아니라 렌더 중 setState라 무한루프 없음).
  const [syncedFrom, setSyncedFrom] = React.useState(savedUrl);
  if (savedUrl !== syncedFrom) {
    setSyncedFrom(savedUrl);
    setUrl(savedUrl);
  }

  const on = !!value?.on && !!savedUrl;
  const dirty = url.trim() !== savedUrl;

  const saveUrl = async () => {
    setSaving(true);
    try {
      const trimmed = url.trim();
      await onSave({ webhookUrl: trimmed, on: trimmed ? (value?.on ?? true) : false });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    if (!savedUrl) return;
    setSaving(true);
    try {
      await onSave({ webhookUrl: savedUrl, on: !on });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!savedUrl || dirty) return;
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await sendTestNotification(service, savedUrl);
      setTestResult(ok ? "ok" : "fail");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-[#f1f5f9] py-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <span
          className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: bg }}
        >
          <Icon className="size-4" style={{ color }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold">{name}</span>
            <span style={pill(on ? "#f0fdf4" : "#f1f5f9", on ? "#15803d" : "#94a3b8")}>
              {on ? "연동됨" : "미연동"}
            </span>
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{desc}</div>
        </div>
        <button
          onClick={toggle}
          disabled={!savedUrl || saving}
          className={cn(
            "h-8 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50",
            on
              ? "border border-border bg-card text-muted-foreground hover:bg-secondary"
              : "bg-primary text-primary-foreground hover:bg-primary-hover",
          )}
        >
          {on ? "연동 해제" : "연동하기"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-[46px]">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setTestResult(null);
          }}
          placeholder="https://... (Incoming Webhook URL)"
          className={cn(fieldInput, "min-w-[220px] flex-1 font-mono text-[12px]")}
        />
        <button
          onClick={saveUrl}
          disabled={!dirty || saving}
          className="h-9 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : "저장"}
        </button>
        <button
          onClick={test}
          disabled={!savedUrl || dirty || testing}
          className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary disabled:opacity-50"
        >
          {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          테스트 전송
        </button>
        {testResult === "ok" && (
          <span className="flex items-center gap-1 text-[12px] font-medium text-[#15803d]">
            <Check className="size-3.5" />
            전송 성공
          </span>
        )}
        {testResult === "fail" && (
          <span className="flex items-center gap-1 text-[12px] font-medium text-destructive">
            <X className="size-3.5" />
            전송 실패 — URL을 확인하세요
          </span>
        )}
      </div>
      <p className="pl-[46px] text-[11px] text-muted-foreground">
        Webhook URL이 없다면{" "}
        <a
          href={helpHref}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary hover:underline"
        >
          발급 방법 보기
        </a>
      </p>
    </div>
  );
}
