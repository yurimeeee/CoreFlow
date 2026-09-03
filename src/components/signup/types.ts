import type { SignUpFormValues } from "@/types/user";

export type FormErrors = Partial<Record<keyof SignUpFormValues, string>>;

export interface StepProps {
  values: SignUpFormValues;
  errors: FormErrors;
  set: <K extends keyof SignUpFormValues>(
    key: K,
    value: SignUpFormValues[K],
  ) => void;
}
