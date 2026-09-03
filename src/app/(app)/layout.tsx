import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { AuthGuard } from "@/components/app/AuthGuard";

export const metadata: Metadata = {
  title: "워크스페이스",
};

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
