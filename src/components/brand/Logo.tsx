import { Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  tone?: "default" | "invert";
}

export function Logo({
  className,
  showWordmark = true,
  tone = "default",
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#4f46e5] to-[#6366f1] text-white shadow-[0_2px_8px_rgba(79,70,229,0.35)]">
        <Waypoints className="size-[18px]" strokeWidth={2.4} />
      </span>
      {showWordmark && (
        <span
          className={cn(
            "text-[17px] font-extrabold tracking-[-0.03em]",
            tone === "invert" ? "text-white" : "text-foreground",
          )}
        >
          CoreFlow
        </span>
      )}
    </span>
  );
}
