"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, X } from "lucide-react";
import { buildOtpAuthUri } from "@/lib/totp";
import { twoFactorErrorMessage, type TwoFactorResponse } from "@/lib/twoFactorApi";
import { useTwoFactor } from "@/lib/groupware/hooks";

const fieldInput =
  "h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] text-center font-mono tracking-[0.3em] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

/** 4자리씩 끊어 보여주는 base32 시크릿 (수동 입력용) */
function formatSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export function TwoFactorSetupModal({
  accountName,
  onClose,
  onEnrolled,
}: {
  accountName: string;
  onClose: () => void;
  onEnrolled: (backupCodes: string[]) => void;
}) {
  const { startEnroll, confirmEnroll } = useTwoFactor();
  // 비밀키는 서버가 만들어 등록 대기 상태로 저장하고, 여기선 QR로만 보여 줍니다.
  const [secret, setSecret] = React.useState<string | null>(null);
  const [qrSvg, setQrSvg] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    startEnroll()
      .then((s) => !cancelled && setSecret(s))
      .catch(
        (r: TwoFactorResponse) =>
          !cancelled && setError(twoFactorErrorMessage(r, "2단계 인증 등록을 시작하지 못했습니다.")),
      );
    return () => {
      cancelled = true;
    };
  }, [startEnroll]);

  const uri = React.useMemo(
    () => (secret ? buildOtpAuthUri({ secret, accountName, issuer: "CoreFlow" }) : null),
    [secret, accountName],
  );

  React.useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    QRCode.toString(uri, { type: "svg", margin: 1, width: 196 })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setQrSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한이 없는 환경 — 수동 입력 필드로 대체 */
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(clean)) {
      setError("6자리 숫자를 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      onEnrolled(await confirmEnroll(clean));
    } catch (r) {
      setError(twoFactorErrorMessage(r as TwoFactorResponse, "등록에 실패했습니다. 다시 시도해 주세요."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-[420px] flex-col gap-4.5 rounded-[14px] bg-card p-5.5 shadow-xl">
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: "#eef2ff" }}
          >
            <ShieldCheck className="size-[17px] text-primary" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold tracking-[-0.015em]">
              2단계 인증 설정
            </h3>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-muted-foreground">
              Google Authenticator, Authy 등 OTP 앱으로 아래 QR 코드를
              스캔하세요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-secondary-foreground"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-center rounded-[10px] border border-[#eef1f5] bg-white p-4">
          {qrSvg ? (
            <div
              className="[&_svg]:h-[196px] [&_svg]:w-[196px]"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div className="flex h-[196px] w-[196px] items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            QR을 스캔할 수 없다면 이 키를 직접 입력하세요
          </span>
          <button
            type="button"
            onClick={copySecret}
            className="flex items-center justify-between gap-2 rounded-[9px] border border-border bg-secondary px-3 py-2.5 text-left font-mono text-[13px] tracking-[0.05em] hover:bg-[#f5f6ff]"
          >
            {secret ? formatSecret(secret) : "…"}
            {copied ? (
              <Check className="size-3.5 shrink-0 text-[#15803d]" />
            ) : (
              <Copy className="size-3.5 shrink-0 text-muted-foreground" />
            )}
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
          <label
            htmlFor="totp-confirm"
            className="text-[11.5px] font-semibold text-muted-foreground"
          >
            앱에 표시된 6자리 코드를 입력해 확인하세요
          </label>
          <input
            id="totp-confirm"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className={fieldInput}
            autoFocus
          />
          {error && (
            <p role="alert" className="text-[12px] font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-semibold text-secondary-foreground hover:bg-secondary"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy || !secret || code.length !== 6}
              className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
              확인하고 활성화
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TwoFactorDisableModal({
  onClose,
  onDisabled,
}: {
  onClose: () => void;
  onDisabled: () => void;
}) {
  const { disable } = useTwoFactor();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await disable(code);
      onDisabled();
    } catch (r) {
      setError(twoFactorErrorMessage(r as TwoFactorResponse, "비활성화하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-[400px] flex-col gap-4.5 rounded-[14px] bg-card p-5.5 shadow-xl">
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: "#fff7ed" }}
          >
            <ShieldCheck className="size-[17px] text-[#c2410c]" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold tracking-[-0.015em]">
              2단계 인증 비활성화
            </h3>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-muted-foreground">
              본인 확인을 위해 OTP 앱의 6자리 코드 또는 백업 코드를 입력하세요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-secondary-foreground"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="000000 또는 A1B2-C3D4"
            className={fieldInput}
            autoFocus
          />
          {error && (
            <p role="alert" className="text-[12px] font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-semibold text-secondary-foreground hover:bg-secondary"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy || !code}
              className="flex h-9 items-center gap-1.5 rounded-[9px] bg-destructive px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              비활성화
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TwoFactorBackupCodesModal({
  codes,
  onClose,
}: {
  codes: string[];
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-[420px] flex-col gap-4.5 rounded-[14px] bg-card p-5.5 shadow-xl">
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: "#f0fdf4" }}
          >
            <ShieldCheck className="size-[17px] text-[#15803d]" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold tracking-[-0.015em]">
              2FA가 활성화되었습니다
            </h3>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-muted-foreground">
              OTP 앱을 잃어버렸을 때를 대비해 아래 백업 코드를 안전한 곳에
              저장하세요. 각 코드는 한 번만 사용할 수 있고, 다시 볼 수
              없습니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-[#eef1f5] bg-secondary p-3.5 font-mono text-[13px] tracking-[0.03em]">
          {codes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={copyAll}
            className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3.5 text-[13px] font-semibold text-secondary-foreground hover:bg-secondary"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            모두 복사
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            저장했습니다, 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
