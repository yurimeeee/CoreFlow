"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/lib/groupware/data";
import { NAV_ITEMS } from "./nav";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-66 flex-col bg-[#1e293b] text-slate-100">
      <div className="p-3.5 pb-3">
        <button className="flex w-full items-center gap-2.5 rounded-[10px] border border-transparent p-2 text-left transition-colors hover:border-[#475569] hover:bg-[#334155]">
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#4f46e5] to-[#6366f1] text-white">
            <Waypoints className="size-[18px]" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-slate-50">
              {CURRENT_USER.workspace}
            </span>
            <span className="mt-px block text-[11.5px] text-slate-400">
              기업 워크스페이스
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 text-slate-400" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5">
        <div className="px-2 pb-1.5 pt-2.5 text-[11px] font-semibold tracking-[0.04em] text-slate-500">
          워크스페이스
        </div>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] tracking-[-0.01em] transition-colors",
                active
                  ? "bg-primary font-semibold text-white"
                  : "font-medium text-slate-300 hover:bg-[#334155] hover:text-white",
              )}
            >
              <Icon
                className="size-[17px] shrink-0"
                strokeWidth={active ? 2 : 1.75}
              />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    "flex h-[19px] min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-[#334155] text-slate-300",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#334155] p-2.5">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-[10px] p-2 transition-colors hover:bg-[#334155]"
        >
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#475569] text-[13px] font-semibold text-slate-200">
            {CURRENT_USER.name.charAt(0)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-slate-100">
              {CURRENT_USER.name}{" "}
              <span className="font-normal text-slate-400">
                {CURRENT_USER.role}
              </span>
            </span>
            <span className="mt-px block text-[11.5px] text-slate-400">
              {CURRENT_USER.team}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 text-slate-400" />
        </Link>
      </div>
    </aside>
  );
}
