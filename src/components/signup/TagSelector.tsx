"use client";

import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED = [
  "Frontend",
  "Backend",
  "React",
  "TypeScript",
  "Next.js",
  "Node.js",
  "DevOps",
  "QA",
  "UI/UX",
  "Product",
  "Data",
  "Marketing",
  "Sales",
  "HR",
  "Finance",
  "PM",
  "Design",
  "Mobile",
];

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}

export function TagSelector({ value, onChange, max = 10 }: TagSelectorProps) {
  const [draft, setDraft] = React.useState("");

  const toggle = (tag: string) => {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag));
    } else if (value.length < max) {
      onChange([...value, tag]);
    }
  };

  const addDraft = () => {
    const t = draft.trim();
    if (!t) return;
    if (!value.includes(t) && value.length < max) {
      onChange([...value, t]);
    }
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 선택된 태그 */}
      <div className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-input bg-card p-2.5">
        {value.length === 0 && (
          <span className="px-1 text-sm text-muted-foreground">
            담당 업무 키워드를 선택하거나 직접 입력하세요
          </span>
        )}
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
          >
            {tag}
            <button
              type="button"
              aria-label={`${tag} 제거`}
              onClick={() => toggle(tag)}
              className="rounded-sm hover:bg-white/20"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      {/* 직접 입력 */}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="직접 입력 후 Enter (예: Growth)"
          className="h-10 flex-1 rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <button
          type="button"
          onClick={addDraft}
          className="inline-flex h-10 items-center gap-1 rounded-[var(--radius-md)] border border-border bg-card px-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary"
        >
          <Plus className="size-4" />
          추가
        </button>
      </div>

      {/* 추천 태그 */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED.map((tag) => {
          const active = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-[#cbd5e1] hover:bg-secondary",
              )}
            >
              {active ? (
                <Check className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {tag}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {value.length}/{max} 선택됨
      </p>
    </div>
  );
}
