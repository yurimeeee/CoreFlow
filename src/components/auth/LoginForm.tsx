"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Eye, EyeOff, KeyRound, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { firebaseAuth, firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { adoptTwoFactorToken, twoFactorApi, twoFactorErrorMessage } from "@/lib/twoFactorApi";
import { verifiedTwoFactorId } from "@/lib/twoFactorSession";
import type { UserDoc } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/signup/Field";

interface TwoFactorRequirement {
  uid: string;
}

/**
 * 로그인 직후 2FA 코드 입력이 필요한지 판단합니다 — 본인 users 문서의
 * twoFactorId 가 있고, 이번 브라우저 세션에서 그 등록을 아직 확인하지 않았으면
 * 필요합니다. AuthGuard 와 같은 기준이어야 두 화면이 서로를 무한히
 * 리다이렉트하지 않습니다.
 *
 * gwSettings.twoFA 만 있는 계정은 서버 검증 이전에 2FA를 켠 경우라, 서버
 * (status)가 비밀키 유무를 보고 twoFactorId 로 옮겨 줍니다. 서버가 응답하지
 * 않으면 안전하게 "필요"로 둡니다 — 어차피 보안 규칙이 막습니다.
 */
async function loadTwoFactorRequirement(
  uid: string,
): Promise<TwoFactorRequirement | null> {
  const snap = await getDoc(doc(firebaseDb(), "users", uid));
  const profile = snap.exists() ? (snap.data() as UserDoc) : null;
  if (profile?.twoFactorId) {
    return verifiedTwoFactorId(uid) === profile.twoFactorId ? null : { uid };
  }
  if (!profile?.gwSettings?.twoFA) return null;
  const r = await twoFactorApi("status");
  return r.ok && !r.enabled ? null : { uid };
}

function mapError(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "이메일 또는 비밀번호가 올바르지 않습니다.";
      case "auth/too-many-requests":
        return "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.";
      case "auth/user-disabled":
        return "정지된 계정입니다. 관리자에게 문의해 주세요.";
      default:
        return err.message;
    }
  }
  return "로그인에 실패했습니다.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 비밀번호 인증까지 끝났고, 2FA 코드 확인이 필요한 상태
  const [pending, setPending] = React.useState<TwoFactorRequirement | null>(null);
  const [checkingSession, setCheckingSession] = React.useState(isFirebaseConfigured);
  const [code, setCode] = React.useState("");
  const [useBackup, setUseBackup] = React.useState(false);
  const [twoFABusy, setTwoFABusy] = React.useState(false);
  const [twoFAError, setTwoFAError] = React.useState<string | null>(null);

  const goNext = React.useCallback(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") ? next : "/dashboard");
  }, [router]);

  // 이미 Firebase Auth 세션이 있는 상태로 /login 에 도달한 경우
  // (예: AuthGuard 가 미검증 2FA 때문에 되돌려보낸 경우) 비밀번호 입력을
  // 건너뛰고 바로 2FA 단계를 보여줍니다.
  React.useEffect(() => {
    if (!isFirebaseConfigured) return;
    let cancelled = false;
    (async () => {
      const current = firebaseAuth().currentUser;
      if (!current) {
        if (!cancelled) setCheckingSession(false);
        return;
      }
      const req = await loadTwoFactorRequirement(current.uid);
      if (cancelled) return;
      if (req) {
        setPending(req);
        setCheckingSession(false);
      } else {
        goNext();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goNext]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isFirebaseConfigured) {
      setError("Firebase 환경변수가 설정되지 않았습니다. (.env.local 확인)");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(
        firebaseAuth(),
        email.trim(),
        password,
      );
      const req = await loadTwoFactorRequirement(cred.user.uid);
      if (req) {
        setPending(req);
      } else {
        goNext();
      }
    } catch (err) {
      setError(mapError(err));
    } finally {
      setLoading(false);
    }
  };

  const onSubmitTwoFA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    setTwoFAError(null);
    setTwoFABusy(true);
    try {
      // 서버가 6자리 숫자면 TOTP, 그 외는 백업 코드로 확인하고(백업 코드는
      // 그 자리에서 폐기), 통과하면 2FA 클레임이 든 토큰을 돌려줍니다.
      const r = await twoFactorApi("verify", code);
      if (!r.ok || !r.token || !r.twoFactorId) {
        setTwoFAError(
          r.error === "invalid_code" && useBackup
            ? "백업 코드가 올바르지 않습니다."
            : twoFactorErrorMessage(r, "인증에 실패했습니다. 다시 시도해 주세요."),
        );
        return;
      }
      await adoptTwoFactorToken(r.token, r.twoFactorId);
      goNext();
    } catch {
      setTwoFAError("인증에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setTwoFABusy(false);
    }
  };

  const switchAccount = async () => {
    await signOut(firebaseAuth()).catch(() => {});
    setPending(null);
    setCode("");
    setPassword("");
  };

  if (checkingSession) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pending) {
    return (
      <form onSubmit={onSubmitTwoFA} className="space-y-5">
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[#e0e7ff] bg-[#f5f6ff] px-3.5 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-[13px] leading-[1.6] text-[#4338ca]">
            {useBackup
              ? "OTP 앱을 사용할 수 없다면 백업 코드를 입력하세요."
              : "OTP 앱에 표시된 6자리 코드를 입력하세요."}
          </p>
        </div>

        <Field id="login-2fa-code" label={useBackup ? "백업 코드" : "인증 코드"} required>
          <Input
            id="login-2fa-code"
            value={code}
            onChange={(e) =>
              setCode(
                useBackup
                  ? e.target.value.toUpperCase()
                  : e.target.value.replace(/[^\d]/g, "").slice(0, 6),
              )
            }
            placeholder={useBackup ? "A1B2-C3D4" : "000000"}
            inputMode={useBackup ? "text" : "numeric"}
            autoComplete="one-time-code"
            className="text-center font-mono tracking-[0.3em]"
            autoFocus
            required
          />
        </Field>

        {twoFAError && (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[13px] font-medium text-destructive"
          >
            {twoFAError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={twoFABusy || !code}>
          {twoFABusy ? <Loader2 className="animate-spin" /> : <KeyRound />}
          확인
        </Button>

        <div className="flex items-center justify-between text-[12.5px]">
          <button
            type="button"
            onClick={() => {
              setUseBackup((v) => !v);
              setCode("");
              setTwoFAError(null);
            }}
            className="font-medium text-primary hover:underline"
          >
            {useBackup ? "OTP 코드로 확인하기" : "백업 코드 사용하기"}
          </button>
          <button
            type="button"
            onClick={switchAccount}
            className="font-medium text-muted-foreground hover:text-secondary-foreground"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field id="login-email" label="이메일" required>
        <Input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
      </Field>

      <Field id="login-password" label="비밀번호" required>
        <div className="relative">
          <Input
            id="login-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-secondary-foreground"
            aria-label={show ? "비밀번호 숨기기" : "비밀번호 표시"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[13px] font-medium text-destructive"
        >
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
        로그인
      </Button>
    </form>
  );
}
