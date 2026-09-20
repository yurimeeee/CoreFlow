"use client";

/**
 * Google Identity Services(GIS) 토큰 클라이언트 기반 개인 OAuth 연동 — 공통
 * 로직. Calendar·Drive 등 이 프로젝트의 모든 Google 개인 연동이 이 팩토리로
 * 토큰 클라이언트 로드 · sessionStorage 저장 · 연결/해제를 공유하고, 리소스별
 * REST 호출(일정 조회, 파일 업로드 등)만 각 모듈(googleCalendar.ts,
 * googleDrive.ts)에 남습니다.
 *
 * 이 프로젝트엔 백엔드가 없어서 refresh token을 안전하게 보관할 곳이
 * 없습니다 — access token은 이 탭의 sessionStorage에만 두고, 만료(보통
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
export const isGoogleClientConfigured = GOOGLE_CLIENT_ID.length > 0;

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

async function fetchEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("userinfo_failed");
  const data = (await res.json()) as { email?: string };
  return data.email ?? "";
}

export interface GoogleOAuthClient {
  /** 현재 탭에서 유효한(만료 전) 연결 상태를 읽습니다. */
  getSession(): { email: string } | null;
  /** 유효한 access token, 없으면 null. */
  getAccessToken(): string | null;
  /** OAuth 동의 팝업을 띄워 연결합니다. 성공 시 이메일을 반환합니다. */
  connect(): Promise<{ email: string }>;
  /** 연결을 해제하고 저장된 토큰을 폐기합니다. */
  disconnect(): void;
}

/** scope·storageKey 별로 독립된 OAuth 클라이언트를 만듭니다(Calendar/Drive 등 리소스마다 하나씩). */
export function createGoogleOAuthClient(opts: {
  scope: string;
  storageKey: string;
}): GoogleOAuthClient {
  const { scope, storageKey } = opts;

  function readStoredToken(): StoredToken | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
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
      if (token) window.sessionStorage.setItem(storageKey, JSON.stringify(token));
      else window.sessionStorage.removeItem(storageKey);
    } catch {
      /* noop */
    }
  }

  return {
    getSession() {
      const token = readStoredToken();
      return token ? { email: token.email } : null;
    },

    getAccessToken() {
      return readStoredToken()?.accessToken ?? null;
    },

    async connect() {
      if (!isGoogleClientConfigured) throw new Error("not_configured");
      await loadGis();
      const email = await new Promise<string>((resolve, reject) => {
        const client = window.google!.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope,
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
    },

    disconnect() {
      const token = readStoredToken();
      writeStoredToken(null);
      if (token && window.google?.accounts?.oauth2) {
        window.google.accounts.oauth2.revoke(token.accessToken, () => {});
      }
    },
  };
}
