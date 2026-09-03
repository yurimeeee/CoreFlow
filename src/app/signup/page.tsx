import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { SignUpClient } from "@/components/signup/SignUpClient";

export const metadata: Metadata = {
  title: "회원가입",
  description: "CoreFlow 초대 링크 기반 회원가입",
};

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <SignUpClient />
    </Suspense>
  );
}
