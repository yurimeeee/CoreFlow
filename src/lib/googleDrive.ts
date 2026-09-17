"use client";

/**
 * Google Drive 개인 연동 — Google Calendar와 동일한 GIS(Google Identity
 * Services) 토큰 클라이언트로 OAuth 액세스 토큰을 받아 브라우저에서 직접
 * Drive REST API를 호출합니다. `drive.file` 스코프만 요청하므로 이 앱으로
 * 업로드/생성한 파일에만 접근할 수 있습니다(기존 Drive 파일 전체 조회 불가).
 *
 * 결재 첨부파일을 업로드하면(연동 중일 때) 같은 파일을 이 사용자의 Drive에도
 * 함께 올려 "결재 첨부파일을 드라이브에 보관"을 실제로 수행합니다.
 *
 * 이 프로젝트엔 백엔드가 없어서 refresh token을 안전하게 보관할 곳이
 * 없습니다 — access token은 이 탭의 sessionStorage에만 두고, 만료(보통
 * 1시간)되면 다시 "연동하기"로 재인증해야 합니다.
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
export const isGoogleDriveConfigured = GOOGLE_CLIENT_ID.length > 0;

const SCOPE =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
const STORAGE_KEY = "cf_gdrive_token";
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
export function getGoogleDriveSession(): { email: string } | null {
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
export async function connectGoogleDrive(): Promise<{ email: string }> {
  if (!isGoogleDriveConfigured) {
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
export function disconnectGoogleDrive(): void {
  const token = readStoredToken();
  writeStoredToken(null);
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token.accessToken, () => {});
  }
}

export interface GoogleDriveFileSummary {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

/**
 * 연동 테스트 겸 실사용 — 이 앱이 Drive에 올린 파일 목록을 가져옵니다.
 * `drive.file` 스코프 특성상 사용자의 기존 Drive 파일 전체가 아니라
 * 이 앱으로 업로드/생성한 파일만 조회됩니다.
 */
export async function listAppDriveFiles(maxResults = 5): Promise<GoogleDriveFileSummary[]> {
  const token = readStoredToken();
  if (!token) throw new Error("not_connected");
  const params = new URLSearchParams({
    pageSize: String(maxResults),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,webViewLink,modifiedTime)",
    spaces: "drive",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) throw new Error(`list_failed_${res.status}`);
  const data = (await res.json()) as { files?: GoogleDriveFileSummary[] };
  return data.files ?? [];
}

/** 결재 첨부파일을 이 사용자의 Google Drive에도 업로드합니다 (best-effort). */
export async function uploadFileToDrive(
  file: File,
): Promise<GoogleDriveFileSummary | null> {
  const token = readStoredToken();
  if (!token) return null;
  try {
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify({ name: file.name })], { type: "application/json" }),
    );
    form.append("file", file);
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.accessToken}` },
        body: form,
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as GoogleDriveFileSummary;
  } catch {
    return null;
  }
}
