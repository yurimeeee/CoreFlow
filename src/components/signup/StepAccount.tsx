"use client";

import * as React from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";
import type { StepProps } from "./types";
import { cn } from "@/lib/utils";

function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) || /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const STRENGTH = ["매우 약함", "약함", "보통", "강함", "매우 강함"];

export function StepAccount({ values, errors, set }: StepProps) {
  const [show, setShow] = React.useState(false);
  const score = passwordScore(values.password);

  return (
    <div className="animate-step space-y-6">
      {/* 초대 정보 (Read-only) */}
      <section className="rounded-[var(--radius-lg)] border border-accent-foreground/15 bg-accent/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-accent-foreground">
          <ShieldCheck className="size-4" />
          관리자가 등록한 초대 정보입니다
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="email" label="회사 이메일" readOnlyHint>
            <Input id="email" value={values.email} readOnly />
          </Field>
          <Field id="employeeId" label="사번" readOnlyHint>
            <Input id="employeeId" value={values.employeeId} readOnly />
          </Field>
          <Field id="departmentName" label="소속 부서" readOnlyHint>
            <Input
              id="departmentName"
              value={values.departmentName || values.departmentId}
              readOnly
            />
          </Field>
          <Field id="position" label="직급 / 직책" readOnlyHint>
            <Input id="position" value={values.position} readOnly />
          </Field>
        </div>
      </section>

      {/* 사용자 입력 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="이름" required error={errors.name}>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="홍길동"
            autoComplete="name"
          />
        </Field>
        <Field id="phone" label="휴대폰 번호" required error={errors.phone}>
          <Input
            id="phone"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="010-1234-5678"
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>
        <Field
          id="joinedAt"
          label="입사일"
          required
          error={errors.joinedAt}
          className="sm:col-span-2"
        >
          <Input
            id="joinedAt"
            type="date"
            value={values.joinedAt}
            onChange={(e) => set("joinedAt", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="password"
          label="비밀번호"
          required
          error={errors.password}
          hint="8자 이상, 영문 · 숫자 조합 권장"
        >
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              value={values.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
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
        <Field
          id="passwordConfirm"
          label="비밀번호 확인"
          required
          error={errors.passwordConfirm}
        >
          <Input
            id="passwordConfirm"
            type={show ? "text" : "password"}
            value={values.passwordConfirm}
            onChange={(e) => set("passwordConfirm", e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </Field>
      </div>

      {values.password && (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i < score
                    ? score <= 1
                      ? "bg-destructive"
                      : score === 2
                        ? "bg-warning"
                        : "bg-success"
                    : "bg-border",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            비밀번호 강도: {STRENGTH[score]}
          </p>
        </div>
      )}
    </div>
  );
}
