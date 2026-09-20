"use client";

import * as React from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "표정",
    items: [
      "😀", "😄", "😅", "😂", "🥹", "😊", "😉", "😍", "🥰", "😘",
      "🤔", "🙄", "😴", "😭", "😢", "😡", "🥲", "😱", "🤯", "😎",
    ],
  },
  {
    label: "제스처",
    items: [
      "👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "✌️", "🤞", "👋",
    ],
  },
  {
    label: "업무",
    items: [
      "🎉", "🔥", "✅", "❌", "⭐", "❗", "❓", "💡", "📌", "⏰",
      "🚀", "☕", "📎", "💯",
    ],
  },
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-[9px] transition-colors",
          open
            ? "bg-accent text-accent-foreground"
            : "text-secondary-foreground hover:bg-secondary",
        )}
        aria-label="이모지"
      >
        <Smile className="size-[18px]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-step absolute bottom-11 left-0 z-20 w-[264px] rounded-[14px] border border-border bg-card p-3 shadow-[var(--shadow-pop)]">
            {EMOJI_GROUPS.map((g) => (
              <div key={g.label} className="mb-2 last:mb-0">
                <div className="mb-1 text-[10.5px] font-semibold tracking-[0.02em] text-muted-foreground">
                  {g.label}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {g.items.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        onPick(e);
                        setOpen(false);
                      }}
                      className="flex size-8 items-center justify-center rounded-lg text-[17px] hover:bg-secondary"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
