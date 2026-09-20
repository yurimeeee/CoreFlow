"use client";

import * as React from "react";
import { CalendarDays, Check, Loader2, RefreshCw } from "lucide-react";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarSession,
  isGoogleCalendarConfigured,
  listUpcomingGoogleEvents,
  type GoogleCalendarEventSummary,
} from "@/lib/googleCalendar";
import { IntegrationCard, IntegrationConnectButton } from "./IntegrationCard";

function formatEventStart(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // 종일 일정은 yyyy-mm-dd 그대로
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Google Calendar 개인 연동 카드.
 * - OAuth 팝업으로 연결 → 다가오는 일정을 실제로 불러와 살아있는 연동임을 보여줍니다.
 * - 이 탭(브라우저)에서만 유지되는 연결입니다 — 새로고침/다른 기기에서는 재연결이 필요합니다.
 */
export function GoogleCalendarConnect() {
  const [email, setEmail] = React.useState<string | null>(
    () => getGoogleCalendarSession()?.email ?? null,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<GoogleCalendarEventSummary[] | null>(null);
  const [loadingEvents, setLoadingEvents] = React.useState(false);

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      const session = await connectGoogleCalendar();
      setEmail(session.email || "(이메일 조회 실패)");
    } catch {
      setError("연결에 실패했습니다. 팝업이 차단되지 않았는지 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    disconnectGoogleCalendar();
    setEmail(null);
    setEvents(null);
    setError(null);
  };

  const loadEvents = async () => {
    setLoadingEvents(true);
    setError(null);
    try {
      const list = await listUpcomingGoogleEvents(5);
      setEvents(list);
    } catch {
      setError("일정을 불러오지 못했습니다. 연결이 만료됐다면 다시 연동해 주세요.");
      setEvents(null);
    } finally {
      setLoadingEvents(false);
    }
  };

  const on = !!email;

  return (
    <IntegrationCard
      icon={CalendarDays}
      iconBg="#eef2ff"
      iconColor="#4338ca"
      name="Google Calendar"
      connected={on}
      statusLabel={on ? email : "사내 일정과 내 개인 캘린더를 동기화합니다 (내 계정 기준)"}
      error={error}
      action={
        !isGoogleCalendarConfigured ? (
          <span className="text-[11.5px] font-medium text-muted-foreground">
            관리자 설정 필요
          </span>
        ) : (
          <IntegrationConnectButton
            connected={on}
            busy={busy}
            onClick={on ? disconnect : connect}
            busyIcon={<Loader2 className="size-3.5 animate-spin" />}
          />
        )
      }
    >
      {!isGoogleCalendarConfigured && (
        <p className="pl-[46px] text-[11px] text-muted-foreground">
          <code className="rounded bg-secondary px-1 py-0.5">
            NEXT_PUBLIC_GOOGLE_CLIENT_ID
          </code>{" "}
          환경변수가 없어 연동 버튼이 비활성화되어 있습니다. Google Cloud
          Console에서 OAuth 클라이언트 ID를 발급해 <code>.env.local</code>에
          추가하세요.
        </p>
      )}

      {on && (
        <div className="flex flex-col gap-2 pl-[46px]">
          <button
            onClick={loadEvents}
            disabled={loadingEvents}
            className="flex h-8.5 w-fit items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary disabled:opacity-50"
          >
            {loadingEvents ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            다가오는 일정 불러오기 (연동 테스트)
          </button>
          {events && (
            <ul className="flex flex-col gap-1 rounded-[10px] border border-[#eef1f5] bg-secondary p-3 text-[12px]">
              {events.length === 0 && (
                <li className="text-muted-foreground">예정된 일정이 없습니다.</li>
              )}
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <Check className="size-3 shrink-0 text-[#15803d]" />
                  <span className="font-medium">{e.summary}</span>
                  <span className="text-muted-foreground">{formatEventStart(e.start)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">
            연동 중 CoreFlow 캘린더에 새 일정을 추가하면 이 Google 계정에도
            함께 생성됩니다. 연결은 이 브라우저 탭 기준 약 50분간 유지되며,
            만료되면 다시 연동해야 합니다.
          </p>
        </div>
      )}
    </IntegrationCard>
  );
}
