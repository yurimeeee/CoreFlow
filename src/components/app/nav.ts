import type { LucideIcon } from "lucide-react";
import {
  Clock,
  FileCheck2,
  LayoutDashboard,
  Megaphone,
  Settings,
  SquareKanban,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/attendance", label: "출퇴근 관리", icon: Clock },
  { href: "/approval", label: "전자결재", icon: FileCheck2, badge: "3" },
  { href: "/tasks", label: "프로젝트 / Task", icon: SquareKanban, badge: "9" },
  { href: "/notice", label: "공지사항", icon: Megaphone, badge: "3" },
  { href: "/org", label: "조직도", icon: Users },
  { href: "/settings", label: "설정", icon: Settings },
];

export const SCREEN_TITLES: Record<string, string> = {
  "/dashboard": "대시보드",
  "/attendance": "출퇴근 / 근태 관리",
  "/approval": "전자결재",
  "/approval/new": "기안 작성",
  "/tasks": "프로젝트 / Task",
  "/notice": "공지사항",
  "/org": "조직도",
  "/settings": "설정",
};

export function screenTitle(pathname: string): string {
  if (SCREEN_TITLES[pathname]) return SCREEN_TITLES[pathname];
  if (pathname.startsWith("/approval/")) return "결재 문서";
  const hit = NAV_ITEMS.find(
    (n) => pathname === n.href || pathname.startsWith(n.href + "/"),
  );
  return hit?.label ?? "CoreFlow";
}
