"use client";

/**
 * Google Calendar 개인 연동 — Google Identity Services(GIS) 토큰 클라이언트로
 * OAuth 액세스 토큰을 받아 브라우저에서 직접 Calendar REST API를 호출합니다
 * (Google API는 CORS를 허용하므로 서버 프록시가 필요 없습니다).
 *
 * 이 프로젝트엔 백엔드가 없어서 refresh token 을 안전하게 보관할 곳이
 * 없습니다 — access token 은 이 탭의 sessionStorage 에만 두고, 만료(보통
 * 1시간)되면 다시 "연동하기"로 재인증해야 합니다. Firestore 에는 토큰이
 * 아니라 "연동 여부/계정 이메일"만 저장합니다.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: (opts?: { prompt?: string }) => void };
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const isGoogleCalendarConfigured = GOOGLE_CLIENT_ID.length > 0;

const SCOPE =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";
const STORAGE_KEY = "cf_gcal_token";
const GIS_SRC = "https://accounts.google.com/gsi/client";

interface StoredToken {
  accessToken: string;
  expiresAt: number; // epoch ms
  email: string;
}

let gisLoadPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gis_load_failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis_load_failed"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

function readStoredToken(): StoredToken | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed.accessToken || parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredToken(token: StoredToken | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(token));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** 현재 탭에서 유효한(만료 전) 연결 상태를 읽습니다. */
export function getGoogleCalendarSession(): { email: string } | null {
  const token = readStoredToken();
  return token ? { email: token.email } : null;
}

async function fetchEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("userinfo_failed");
  const data = (await res.json()) as { email?: string };
  return data.email ?? "";
}

/** OAuth 동의 팝업을 띄워 연결합니다. 성공 시 이메일을 반환합니다. */
export async function connectGoogleCalendar(): Promise<{ email: string }> {
  if (!isGoogleCalendarConfigured) {
    throw new Error("not_configured");
  }
  await loadGis();
  const email = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (!resp.access_token) {
          reject(new Error(resp.error ?? "token_denied"));
          return;
        }
        // Google 토큰 클라이언트는 만료 시간을 콜백에 안 실어주므로 보수적으로 50분으로 둡니다.
        const expiresAt = Date.now() + 50 * 60 * 1000;
        fetchEmail(resp.access_token)
          .then((mail) => {
            writeStoredToken({ accessToken: resp.access_token!, expiresAt, email: mail });
            resolve(mail);
          })
          .catch(() => {
            writeStoredToken({ accessToken: resp.access_token!, expiresAt, email: "" });
            resolve("");
          });
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
  return { email };
}

/** 연결을 해제하고 저장된 토큰을 폐기합니다. */
export function disconnectGoogleCalendar(): void {
  const token = readStoredToken();
  writeStoredToken(null);
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token.accessToken, () => {});
  }
}

export interface GoogleCalendarEventSummary {
  id: string;
  summary: string;
  start: string;
}

/** 연동 테스트 겸 실사용 — 다가오는 일정 N개를 가져옵니다. */
export async function listUpcomingGoogleEvents(
  maxResults = 5,
): Promise<GoogleCalendarEventSummary[]> {
  const token = readStoredToken();
  if (!token) throw new Error("not_connected");
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    timeMin: new Date().toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } },
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
  const token = readStoredToken();
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
          Authorization: `Bearer ${token.accessToken}`,
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
