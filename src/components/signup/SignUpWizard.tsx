"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MailCheck,
  PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper, type StepMeta } from "./Stepper";
import { StepAccount } from "./StepAccount";
import { StepProfile } from "./StepProfile";
import { StepTasks } from "./StepTasks";
import type { FormErrors } from "./types";
import { useSignUp } from "@/hooks/useSignUp";
import type { InviteDoc, SignUpFormValues } from "@/types/user";

const STEPS: StepMeta[] = [
  { id: 1, title: "계정 정보", description: "초대 확인 · 비밀번호 설정" },
  { id: 2, title: "프로필 · 서명", description: "이미지 / 서명 업로드" },
  { id: 3, title: "담당 업무", description: "업무 태그 · 가입 완료" },
];

const PHONE_RE = /^01[016789]-?\d{3,4}-?\d{4}$/;

function buildInitialValues(invite: InviteDoc): SignUpFormValues {
  return {
    email: invite.email,
    employeeId: invite.employeeId,
    departmentId: invite.departmentId,
    departmentName: invite.departmentName ?? "",
    position: invite.position,
    name: "",
    password: "",
    passwordConfirm: "",
    phone: "",
    joinedAt: "",
    profileImageFile: null,
    signatureFile: null,
    extensionNumber: "",
    tasks: [],
    agreeTerms: false,
  };
}

function validateStep(step: number, v: SignUpFormValues): FormErrors {
  const e: FormErrors = {};
  if (step === 1) {
    if (!v.name.trim()) e.name = "이름을 입력해 주세요.";
    if (!v.phone.trim()) e.phone = "휴대폰 번호를 입력해 주세요.";
    else if (!PHONE_RE.test(v.phone.trim()))
      e.phone = "올바른 휴대폰 번호 형식이 아닙니다.";
    if (!v.joinedAt) e.joinedAt = "입사일을 선택해 주세요.";
    if (!v.password) e.password = "비밀번호를 입력해 주세요.";
    else if (v.password.length < 8)
      e.password = "비밀번호는 8자 이상이어야 합니다.";
    if (v.password !== v.passwordConfirm)
      e.passwordConfirm = "비밀번호가 일치하지 않습니다.";
  }
  if (step === 3) {
    if (!v.agreeTerms) e.agreeTerms = "필수 약관에 동의해 주세요.";
  }
  return e;
}

interface SignUpWizardProps {
  invite: InviteDoc;
}

export function SignUpWizard({ invite }: SignUpWizardProps) {
  const [step, setStep] = React.useState(1);
  const [values, setValues] = React.useState<SignUpFormValues>(() =>
    buildInitialValues(invite),
  );
  const [errors, setErrors] = React.useState<FormErrors>({});

  const { signUp, phase, phaseLabel, isSubmitting, isDone, error, result } =
    useSignUp();

  const set = React.useCallback(
    <K extends keyof SignUpFormValues>(key: K, value: SignUpFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [],
  );

  const goNext = () => {
    const e = validateStep(step, values);
    setErrors(e);
    if (Object.keys(e).some((k) => e[k as keyof FormErrors])) return;
    setStep((s) => Math.min(s + 1, STEPS.length));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    const e = validateStep(3, values);
    setErrors(e);
    if (Object.keys(e).some((k) => e[k as keyof FormErrors])) return;
    await signUp({ ...values, invite });
  };

  /* ---------- 가입 완료 화면 ---------- */
  if (isDone && result) {
    const pending = result.status === "PENDING";
    return (
      <div className="animate-step flex flex-col items-center py-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-accent text-primary">
          {pending ? (
            <MailCheck className="size-8" />
          ) : (
            <PartyPopper className="size-8" />
          )}
        </div>
        <h2 className="mt-5 text-xl font-bold tracking-[-0.02em]">
          {pending ? "가입 신청이 접수되었습니다" : "CoreFlow에 오신 것을 환영합니다"}
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {pending ? (
            <>
              관리자 승인 후 <b className="text-secondary-foreground">{values.email}</b>
              로 안내 메일이 발송됩니다. 승인 완료 후 로그인해 주세요.
            </>
          ) : (
            <>
              계정이 활성화되었습니다. 지금 바로 로그인하여 업무의 중심을
              연결하세요.
            </>
          )}
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">
            로그인하러 가기
            <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Stepper steps={STEPS} current={step} />

      <div className="min-h-[320px]">
        {step === 1 && (
          <StepAccount values={values} errors={errors} set={set} />
        )}
        {step === 2 && (
          <StepProfile values={values} errors={errors} set={set} />
        )}
        {step === 3 && (
          <StepTasks
            values={values}
            errors={errors}
            set={set}
            requireApproval={invite.requireApproval}
          />
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[13px] font-medium text-destructive"
        >
          {error}
        </p>
      )}

      {isSubmitting && (
        <p className="flex items-center gap-2 text-[13px] font-medium text-primary">
          <Loader2 className="size-4 animate-spin" />
          {phaseLabel}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
        {step > 1 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={isSubmitting}
          >
            <ArrowLeft />
            이전
          </Button>
        ) : (
          <span />
        )}

        {step < STEPS.length ? (
          <Button type="button" onClick={goNext}>
            다음 단계
            <ArrowRight />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || phase === "done"}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CheckCircle2 />
            )}
            {invite.requireApproval ? "가입 신청하기" : "가입 완료하기"}
          </Button>
        )}
      </div>
    </div>
  );
}
