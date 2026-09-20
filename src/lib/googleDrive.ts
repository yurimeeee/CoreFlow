"use client";

/**
 * Google Drive 개인 연동 — OAuth 팝업/토큰 저장 등 공통 로직은
 * `googleOAuth.ts` 를 쓰고, 여기엔 Drive REST API 호출만 남습니다.
 * `drive.file` 스코프만 요청하므로 이 앱으로 업로드/생성한 파일에만
 * 접근할 수 있습니다(기존 Drive 파일 전체 조회 불가).
 *
 * 결재 첨부파일을 업로드하면(연동 중일 때) 같은 파일을 이 사용자의 Drive에도
 * 함께 올려 "결재 첨부파일을 드라이브에 보관"을 실제로 수행합니다.
 */
import { createGoogleOAuthClient, GOOGLE_CLIENT_ID, isGoogleClientConfigured } from "./googleOAuth";

export { GOOGLE_CLIENT_ID };
export const isGoogleDriveConfigured = isGoogleClientConfigured;

const SCOPE =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";

const client = createGoogleOAuthClient({ scope: SCOPE, storageKey: "cf_gdrive_token" });

export const getGoogleDriveSession = client.getSession;
export const connectGoogleDrive = client.connect;
export const disconnectGoogleDrive = client.disconnect;

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
  const token = client.getAccessToken();
  if (!token) throw new Error("not_connected");
  const params = new URLSearchParams({
    pageSize: String(maxResults),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,webViewLink,modifiedTime)",
    spaces: "drive",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`list_failed_${res.status}`);
  const data = (await res.json()) as { files?: GoogleDriveFileSummary[] };
  return data.files ?? [];
}

/** 결재 첨부파일을 이 사용자의 Google Drive에도 업로드합니다 (best-effort). */
export async function uploadFileToDrive(
  file: File,
): Promise<GoogleDriveFileSummary | null> {
  const token = client.getAccessToken();
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
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as GoogleDriveFileSummary;
  } catch {
    return null;
  }
}
