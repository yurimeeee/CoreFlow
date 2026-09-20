"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MessageSquarePlus, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChats, useCurrentUser, useOrgPeople } from "@/lib/groupware/hooks";
import { avatarStyle } from "@/lib/groupware/ui";
import { GwCard } from "@/components/app/primitives";
import { NewChatDialog } from "@/components/app/NewChatDialog";

function timeLabel(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    const h = d.getHours();
    const period = h < 12 ? "오전" : "오후";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${period} ${h12}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ chatId?: string }>();
  const activeId = params?.chatId ?? null;
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [newOpen, setNewOpen] = React.useState(false);

  const { chats, loading } = useChats();
  const me = useCurrentUser();
  const { people } = useOrgPeople();

  const filtered = chats.filter(
    (c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="flex h-[calc(100dvh-7.75rem)] min-h-[520px] gap-4">
      <GwCard
        className={cn(
          "flex w-full flex-col overflow-hidden md:w-[300px] md:shrink-0",
          activeId && "hidden md:flex",
        )}
      >
        <div className="flex items-center gap-2 border-b border-[#eef1f5] px-4 py-3.5">
          <span className="text-[14px] font-semibold tracking-[-0.02em]">채팅</span>
          <button
            onClick={() => setNewOpen(true)}
            className="ml-auto flex size-8 items-center justify-center rounded-[9px] text-primary hover:bg-[#eef2ff]"
            aria-label="새 채팅"
          >
            <MessageSquarePlus className="size-[18px]" />
          </button>
        </div>
        <div className="px-3 pb-2.5 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-[14px] -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="대화 검색"
              className="h-8.5 w-full rounded-[8px] border border-border bg-secondary pl-8 pr-2.5 text-[12.5px] outline-none transition-colors focus:border-ring focus:bg-card"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#eef2ff] text-primary">
                <Users className="size-5" />
              </span>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                아직 대화가 없습니다.
                <br />새 채팅을 시작해보세요.
              </p>
            </div>
          )}
          {filtered.map((c) => {
            const active = c.id === activeId;
            return (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                className={cn(
                  "flex w-full items-center gap-2.5 border-b border-[#f5f6f8] px-3.5 py-2.5 text-left transition-colors hover:bg-secondary/60",
                  active && "bg-accent",
                )}
              >
                <span className="relative shrink-0">
                  <span style={avatarStyle(c.name.charAt(0), 40)}>
                    {c.type === "group" ? <Users className="size-4" /> : c.name.charAt(0)}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-[13px]",
                        c.unread ? "font-bold" : "font-semibold",
                      )}
                    >
                      {c.name}
                    </span>
                    {c.type === "group" && (
                      <span className="text-[10.5px] text-muted-foreground">
                        {c.memberIds.length}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "truncate text-[11.5px]",
                      c.unread
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {c.lastMessage || "대화를 시작해보세요"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[10.5px] text-muted-foreground">
                    {timeLabel(c.lastMessageAt)}
                  </span>
                  {c.unread && (
                    <span className="size-2 rounded-full bg-destructive" aria-label="안읽은 메시지" />
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </GwCard>

      <div className={cn("flex min-w-0 flex-1", !activeId && "hidden md:flex")}>
        {children}
      </div>

      {newOpen && me.uid && (
        <NewChatDialog
          people={people}
          meUid={me.uid}
          meName={me.name}
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            router.push(`/chat/${id}`);
          }}
        />
      )}
    </div>
  );
}
