"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ArrowRight, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/signup/Field";

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isFirebaseConfigured) {
      setError("Firebase 환경변수가 설정되지 않았습니다. (.env.local 확인)");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(mapError(err));
    } finally {
      setLoading(false);
    }
  };

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
        {!loading && <ArrowRight />}
      </Button>
    </form>
  );
}
