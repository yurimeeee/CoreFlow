"use client";

/**
 * Google Calendar 개인 연동 — OAuth 팝업/토큰 저장 등 공통 로직은
 * `googleOAuth.ts` 를 쓰고, 여기엔 Calendar REST API 호출만 남습니다
 * (Google API는 CORS를 허용하므로 서버 프록시가 필요 없습니다).
 */
import { createGoogleOAuthClient, GOOGLE_CLIENT_ID, isGoogleClientConfigured } from "./googleOAuth";

export { GOOGLE_CLIENT_ID };
export const isGoogleCalendarConfigured = isGoogleClientConfigured;

const SCOPE =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

const client = createGoogleOAuthClient({ scope: SCOPE, storageKey: "cf_gcal_token" });

export const getGoogleCalendarSession = client.getSession;
export const connectGoogleCalendar = client.connect;
export const disconnectGoogleCalendar = client.disconnect;

export interface GoogleCalendarEventSummary {
  id: string;
  summary: string;
  start: string;
}

/** 연동 테스트 겸 실사용 — 다가오는 일정 N개를 가져옵니다. */
export async function listUpcomingGoogleEvents(
  maxResults = 5,
): Promise<GoogleCalendarEventSummary[]> {
  const token = client.getAccessToken();
  if (!token) throw new Error("not_connected");
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    timeMin: new Date().toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`list_failed_${res.status}`);
  const data = (await res.json()) as {
    items?: { id: string; summary?: string; start?: { date?: string; dateTime?: string } }[];
  };
  return (data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary || "(제목 없음)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
  }));
}

export interface GoogleEventInput {
  title: string;
  date: string; // yyyy-mm-dd
  end?: string; // yyyy-mm-dd
  start: string; // HH:MM, "" = 종일
  finish: string; // HH:MM
  allDay: boolean;
  location?: string;
  memo?: string;
}

/** CoreFlow 일정을 이 사용자의 Google Calendar 에도 생성합니다 (best-effort). */
export async function createGoogleCalendarEvent(
  input: GoogleEventInput,
): Promise<boolean> {
  const token = client.getAccessToken();
  if (!token) return false;
  const body = input.allDay
    ? {
        summary: input.title,
        location: input.location || undefined,
        description: input.memo || undefined,
        start: { date: input.date },
        end: { date: input.end || input.date },
      }
    : {
        summary: input.title,
        location: input.location || undefined,
        description: input.memo || undefined,
        start: { dateTime: `${input.date}T${input.start || "09:00"}:00`, timeZone: "Asia/Seoul" },
        end: {
          dateTime: `${input.end || input.date}T${input.finish || input.start || "10:00"}:00`,
          timeZone: "Asia/Seoul",
        },
      };
  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
