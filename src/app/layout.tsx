import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { FirebaseAnalytics } from "@/components/analytics/FirebaseAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CoreFlow — 모든 업무의 중심을 잇다",
    template: "%s · CoreFlow",
  },
  description:
    "출퇴근 기록부터 전자결재, 프로젝트 관리, 조직도까지 — 파편화된 기업의 핵심 업무를 끊김 없는 하나의 흐름으로 연결하는 B2B 그룹웨어.",
  applicationName: "CoreFlow",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

/** localStorage("cf_theme")·시스템 설정 기준으로 첫 페인트 전에 .dark를 세팅 — src/lib/theme.ts와 동일한 규칙을 유지해야 합니다. */
const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem("cf_theme");var dark=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" richColors />
        <FirebaseAnalytics />
      </body>
    </html>
  );
}
