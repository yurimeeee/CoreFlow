import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "로그인",
  description: "CoreFlow 로그인",
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="CoreFlow"
      title="다시 오신 것을 환영합니다"
      subtitle="회사 계정으로 로그인하여 업무의 흐름을 이어가세요."
      footer={
        <>
          초대 링크를 받으셨나요?{" "}
          <Link
            href="/signup"
            className="font-semibold text-primary hover:underline"
          >
            회원가입
          </Link>
        </>
      }
    >
      <Card>
        <CardContent className="p-6 sm:p-8">
          <LoginForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
