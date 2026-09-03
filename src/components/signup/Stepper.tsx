"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepMeta {
  id: number;
  title: string;
  description: string;
}

interface StepperProps {
  steps: StepMeta[];
  current: number; // 1-indexed
}

export function Stepper({ steps, current }: StepperProps) {
  const pct = ((current - 1) / (steps.length - 1)) * 100;

  return (
    <div className="w-full">
      {/* 데스크탑 */}
      <ol className="relative hidden items-start justify-between sm:flex">
        <span
          className="absolute left-0 top-4 -z-0 h-0.5 w-full bg-border"
          aria-hidden
        />
        <span
          className="absolute left-0 top-4 -z-0 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
        {steps.map((step) => {
          const done = step.id < current;
          const active = step.id === current;
          return (
            <li
              key={step.id}
              className="relative z-10 flex w-1/3 flex-col items-center text-center"
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 bg-card text-[13px] font-bold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : step.id}
              </span>
              <span
                className={cn(
                  "mt-2 text-[13px] font-semibold",
                  active || done
                    ? "text-secondary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.title}
              </span>
              <span className="mt-0.5 hidden text-xs text-muted-foreground md:block">
                {step.description}
              </span>
            </li>
          );
        })}
      </ol>

      {/* 모바일 */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-primary">
            STEP {current} / {steps.length}
          </span>
          <span className="text-[13px] font-semibold text-secondary-foreground">
            {steps[current - 1]?.title}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(current / steps.length) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {steps[current - 1]?.description}
        </p>
      </div>
    </div>
  );
}
