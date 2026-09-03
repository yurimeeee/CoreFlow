import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-[0.02em] transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        soft: "bg-accent text-accent-foreground",
        outline: "border border-border text-muted-foreground",
        success: "bg-[#dcfce7] text-[#15803d]",
        warning: "bg-[#fef3c7] text-[#b45309]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
