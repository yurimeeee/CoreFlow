"use client";

import { CircleCheck, Info } from "lucide-react";
import { TagSelector } from "./TagSelector";
import { Field } from "./Field";
import type { StepProps } from "./types";

interface StepTasksProps extends StepProps {
  requireApproval: boolean;
}

export function StepTasks({
  values,
  errors,
  set,
  requireApproval,
}: StepTasksProps) {
  return (
    <div className="animate-step space-y-6">
      <Field
        id="tasks"
        label="담당 업무 키워드 (선택)"
        error={errors.tasks}
        hint="조직도 · 프로젝트 배정 시 활용됩니다"
      >
        <TagSelector
          value={values.tasks}
          onChange={(tags) => set("tasks", tags)}
        />
      </Field>

      <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/60 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {requireApproval ? (
            <>
              가입 신청 후 <b className="text-secondary-foreground">관리자 승인</b>이
              완료되면 CoreFlow의 모든 기능을 사용할 수 있습니다. 승인 결과는
              가입한 이메일로 안내됩니다.
            </>
          ) : (
            <>
              가입이 완료되면 <b className="text-secondary-foreground">즉시</b>{" "}
              CoreFlow에 로그인할 수 있습니다.
            </>
          )}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-input p-3.5 transition-colors hover:bg-secondary/60">
        <input
          type="checkbox"
          checked={values.agreeTerms}
          onChange={(e) => set("agreeTerms", e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--color-primary)]"
        />
        <span className="text-[13px] leading-relaxed text-secondary-foreground">
          <b>[필수]</b> CoreFlow 서비스 이용약관 및 개인정보 수집·이용에
          동의합니다. 수집 항목: 이름, 연락처, 입사일, 부서/직급, 프로필 이미지,
          전자결재 서명.
        </span>
      </label>
      {errors.agreeTerms && (
        <p className="-mt-3 text-xs font-medium text-destructive">
          {errors.agreeTerms}
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CircleCheck className="size-4 text-success" />
        입력하신 정보는 <code className="font-mono">users/&#123;uid&#125;</code>{" "}
        문서로 저장됩니다.
      </div>
    </div>
  );
}
