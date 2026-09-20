"use client";

import { Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";
import { FileDropzone } from "./FileDropzone";
import type { StepProps } from "./types";

export function StepProfile({ values, errors, set }: StepProps) {
  return (
    <div className="animate-step space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <FileDropzone
          id="profileImageFile"
          label="프로필 사진 (선택)"
          variant="avatar"
          file={values.profileImageFile}
          onChange={(f) => set("profileImageFile", f)}
          hint="정사각형 이미지를 권장합니다 · 최대 5MB"
        />
        <FileDropzone
          id="signatureFile"
          label="전자결재용 서명 / 직인 (선택)"
          variant="signature"
          file={values.signatureFile}
          onChange={(f) => set("signatureFile", f)}
          hint="배경이 투명한 PNG를 권장합니다 · 최대 5MB"
        />
      </div>

      <Field
        id="extensionNumber"
        label="사내 내선 번호 (선택)"
        error={errors.extensionNumber}
        hint="전자결재 · 조직도에서 동료가 참고합니다"
      >
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="extensionNumber"
            value={values.extensionNumber}
            onChange={(e) => set("extensionNumber", e.target.value)}
            placeholder="1024"
            inputMode="numeric"
            className="pl-9"
          />
        </div>
      </Field>

      <p className="rounded-[var(--radius-md)] bg-secondary px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        업로드한 파일은 안전하게 저장되며, 전자결재 서명은 결재 문서에만
        사용됩니다.
      </p>
    </div>
  );
}
