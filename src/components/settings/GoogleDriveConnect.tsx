"use client";

import * as React from "react";
import { Check, ExternalLink, HardDrive, Loader2, RefreshCw } from "lucide-react";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getGoogleDriveSession,
  isGoogleDriveConfigured,
  listAppDriveFiles,
  type GoogleDriveFileSummary,
} from "@/lib/googleDrive";
import { IntegrationCard, IntegrationConnectButton } from "./IntegrationCard";

function formatModified(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Google Drive 개인 연동 카드.
 * - OAuth 팝업으로 연결 → 이 앱이 올린 파일 목록을 실제로 불러와 살아있는 연동임을 보여줍니다.
 * - 연동 중에는 결재 첨부파일 업로드 시 같은 파일이 이 Drive 계정에도 함께 올라갑니다.
 * - 이 탭(브라우저)에서만 유지되는 연결입니다 — 새로고침/다른 기기에서는 재연결이 필요합니다.
 */
export function GoogleDriveConnect() {
  const [email, setEmail] = React.useState<string | null>(
    () => getGoogleDriveSession()?.email ?? null,
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [files, setFiles] = React.useState<GoogleDriveFileSummary[] | null>(null);
  const [loadingFiles, setLoadingFiles] = React.useState(false);

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      const session = await connectGoogleDrive();
      setEmail(session.email || "(이메일 조회 실패)");
    } catch {
      setError("연결에 실패했습니다. 팝업이 차단되지 않았는지 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    disconnectGoogleDrive();
    setEmail(null);
    setFiles(null);
    setError(null);
  };

  const loadFiles = async () => {
    setLoadingFiles(true);
    setError(null);
    try {
      const list = await listAppDriveFiles(5);
      setFiles(list);
    } catch {
      setError("파일 목록을 불러오지 못했습니다. 연결이 만료됐다면 다시 연동해 주세요.");
      setFiles(null);
    } finally {
      setLoadingFiles(false);
    }
  };

  const on = !!email;

  return (
    <IntegrationCard
      icon={HardDrive}
      iconBg="#f0fdf4"
      iconColor="#15803d"
      name="Google Drive"
      connected={on}
      statusLabel={on ? email : "결재 첨부파일을 업로드할 때 내 Drive에도 함께 보관합니다"}
      error={error}
      action={
        !isGoogleDriveConfigured ? (
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
      {!isGoogleDriveConfigured && (
        <p className="pl-[46px] text-[11px] text-muted-foreground">
          <code className="rounded bg-secondary px-1 py-0.5">
            NEXT_PUBLIC_GOOGLE_CLIENT_ID
          </code>{" "}
          환경변수가 없어 연동 버튼이 비활성화되어 있습니다. Google Cloud
          Console에서 OAuth 클라이언트 ID를 발급해 <code>.env.local</code>에
          추가하세요(Google Calendar 연동과 같은 클라이언트 ID를 공유합니다).
        </p>
      )}

      {on && (
        <div className="flex flex-col gap-2 pl-[46px]">
          <button
            onClick={loadFiles}
            disabled={loadingFiles}
            className="flex h-8.5 w-fit items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary disabled:opacity-50"
          >
            {loadingFiles ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            업로드한 파일 불러오기 (연동 테스트)
          </button>
          {files && (
            <ul className="flex flex-col gap-1 rounded-[10px] border border-[#eef1f5] bg-secondary p-3 text-[12px]">
              {files.length === 0 && (
                <li className="text-muted-foreground">
                  아직 이 앱으로 올린 파일이 없습니다. 결재 첨부파일을 업로드하면
                  여기 표시됩니다.
                </li>
              )}
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <Check className="size-3 shrink-0 text-[#15803d]" />
                  <span className="flex-1 truncate font-medium">{f.name}</span>
                  <span className="text-muted-foreground">
                    {formatModified(f.modifiedTime)}
                  </span>
                  {f.webViewLink && (
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">
            연동 중 결재 첨부파일을 업로드하면 같은 파일이 이 Google 계정
            Drive에도 함께 올라갑니다(이 앱이 만든 파일만 접근합니다). 연결은
            이 브라우저 탭 기준 약 50분간 유지되며, 만료되면 다시 연동해야
            합니다.
          </p>
        </div>
      )}
    </IntegrationCard>
  );
}
