"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  File as FileIcon,
  Loader2,
  Paperclip,
  Send,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatMessages, useChats, useCurrentUser } from "@/lib/groupware/hooks";
import type { ChatMessageDoc } from "@/lib/groupware/firestore";
import { avatarStyle } from "@/lib/groupware/ui";
import { GwCard } from "@/components/app/primitives";
import { EmojiPicker } from "@/components/app/EmojiPicker";

function fileSizeLabel(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function dayLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function timeLabel(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const period = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface ThreadRow {
  message: ChatMessageDoc;
  showDay: boolean;
  showSender: boolean;
}

/** 날짜 구분선/발신자 표시 여부를 메시지 목록 순서를 훑으며 미리 계산합니다. */
function buildThreadRows(messages: ChatMessageDoc[], isGroup: boolean, myUid: string | null): ThreadRow[] {
  let prevDay = "";
  let prevSender: string | null = null;
  return messages.map((m) => {
    const mine = m.senderId === myUid;
    const day = dayLabel(m.createdAt);
    const showDay = day !== prevDay;
    const showSender = !mine && isGroup && prevSender !== m.senderId;
    prevDay = day;
    prevSender = m.senderId;
    return { message: m, showDay, showSender };
  });
}

export default function ChatThreadPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = decodeURIComponent(params.chatId ?? "");
  const me = useCurrentUser();
  const { chats, loading: chatsLoading } = useChats();
  const chat = chats.find((c) => c.id === chatId) ?? null;
  const { messages, loading: msgLoading, sendText, sendFile, markRead } =
    useChatMessages(chatId);

  const [draft, setDraft] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (messages.length > 0) markRead();
  }, [chatId, messages.length, markRead]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const submit = () => {
    const text = draft;
    if (!text.trim()) return;
    setDraft("");
    sendText(text);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await sendFile(file);
    } finally {
      setUploading(false);
    }
  };

  const unreadCountFor = (m: ChatMessageDoc): number => {
    if (!chat || m.senderId !== me.uid) return 0;
    return chat.memberIds.filter(
      (uid) => uid !== m.senderId && (chat.readAt[uid] ?? 0) < m.createdAt,
    ).length;
  };

  const rows = buildThreadRows(messages, chat?.type === "group", me.uid);

  if (!chatsLoading && !chat) {
    return (
      <GwCard className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-[13px] text-muted-foreground">
          대화를 찾을 수 없거나 접근 권한이 없습니다.
        </p>
        <Link
          href="/chat"
          className="text-[12.5px] font-semibold text-primary hover:underline"
        >
          채팅 목록으로
        </Link>
      </GwCard>
    );
  }

  return (
    <GwCard className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-4 py-3">
        <Link
          href="/chat"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary md:hidden"
        >
          <ArrowLeft className="size-4" />
        </Link>
        {chat && (
          <>
            <span style={avatarStyle(chat.name.charAt(0), 34)}>
              {chat.type === "group" ? <Users className="size-4" /> : chat.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">
                {chat.name}
              </div>
              {chat.type === "group" && (
                <div className="truncate text-[11px] text-muted-foreground">
                  {chat.memberIds.map((uid) => chat.memberNames[uid] ?? "").join(", ")}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {!msgLoading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-[12.5px] text-muted-foreground">
              아직 대화가 없습니다. 첫 메시지를 보내보세요.
            </p>
          </div>
        )}
        {rows.map(({ message: m, showDay, showSender }) => {
          const mine = m.senderId === me.uid;
          const unread = unreadCountFor(m);

          return (
            <React.Fragment key={m.id}>
              {showDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[10.5px] font-semibold text-muted-foreground">
                    {dayLabel(m.createdAt)}
                  </span>
                </div>
              )}
              <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
                {!mine && (
                  <span
                    style={avatarStyle(m.senderName.charAt(0), 28)}
                    className={cn("mt-4 shrink-0", !showSender && "opacity-0")}
                  >
                    {m.senderName.charAt(0)}
                  </span>
                )}
                <div className={cn("flex max-w-[72%] flex-col gap-1", mine ? "items-end" : "items-start")}>
                  {showSender && (
                    <span className="px-1 text-[11px] font-semibold text-muted-foreground">
                      {m.senderName}
                    </span>
                  )}
                  <div className={cn("flex items-end gap-1.5", mine ? "flex-row-reverse" : "flex-row")}>
                    <MessageBubble message={m} mine={mine} />
                    <div className="flex shrink-0 flex-col items-center gap-0.5 pb-0.5">
                      {mine && unread > 0 && (
                        <span className="text-[10px] font-semibold text-primary">{unread}</span>
                      )}
                      <span className="whitespace-nowrap text-[10px] text-[#cbd5e1]">
                        {timeLabel(m.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-end gap-1.5 border-t border-[#eef1f5] px-3 py-2.5">
        <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex size-9 shrink-0 items-center justify-center rounded-[9px] text-secondary-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          aria-label="파일 첨부"
        >
          {uploading ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <Paperclip className="size-[18px]" />
          )}
        </button>
        <EmojiPicker onPick={(e) => setDraft((d) => d + e)} />
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="메시지 입력…"
          className="max-h-28 min-h-9.5 flex-1 resize-none rounded-[9px] border border-border bg-secondary px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring focus:bg-card"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[9px] transition-colors",
            draft.trim()
              ? "bg-primary text-primary-foreground hover:bg-primary-hover"
              : "cursor-not-allowed bg-[#f1f5f9] text-muted-foreground",
          )}
          aria-label="전송"
        >
          <Send className="size-4" />
        </button>
      </div>
    </GwCard>
  );
}

function MessageBubble({ message: m, mine }: { message: ChatMessageDoc; mine: boolean }) {
  if (m.type === "image") {
    return (
      <a href={m.fileUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[14px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={m.fileUrl}
          alt={m.fileName ?? "이미지"}
          className="max-h-[280px] max-w-[240px] object-cover"
        />
      </a>
    );
  }

  if (m.type === "file") {
    return (
      <a
        href={m.fileUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex items-center gap-2.5 rounded-[14px] border px-3 py-2.5",
          mine ? "border-[#c7d2fe] bg-[#eef2ff]" : "border-border bg-secondary",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-card text-primary">
          <FileIcon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block max-w-[160px] truncate text-[12.5px] font-semibold">
            {m.fileName}
          </span>
          <span className="block text-[10.5px] text-muted-foreground">
            {fileSizeLabel(m.fileSize)}
          </span>
        </span>
        <Download className="size-3.5 shrink-0 text-muted-foreground" />
      </a>
    );
  }

  return (
    <div
      className={cn(
        "whitespace-pre-wrap break-words rounded-[14px] px-3.5 py-2 text-[13px] leading-relaxed",
        mine
          ? "rounded-tr-[4px] bg-primary text-primary-foreground"
          : "rounded-tl-[4px] bg-secondary text-foreground",
      )}
    >
      {m.text}
    </div>
  );
}
