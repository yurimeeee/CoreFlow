"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useChats } from "@/lib/groupware/hooks";

/**
 * 다른 화면을 보고 있는 동안 새 채팅 메시지가 오면 토스트로 알려줍니다.
 * 첫 구독 스냅샷(앱 진입 시점의 기존 대화)은 알리지 않고, 그 이후 실시간으로
 * lastMessageAt이 올라간 경우만 알립니다. 지금 그 대화방을 보고 있으면
 * (이미 markRead가 처리하므로) 알리지 않습니다.
 */
export function ChatNotifier() {
  const { chats, loading } = useChats();
  const pathname = usePathname();
  const router = useRouter();
  const seenRef = React.useRef<Map<string, number> | null>(null);

  React.useEffect(() => {
    // Firestore 구독이 아직 실제 스냅샷을 받기 전(chats가 임시로 빈 배열인
    // 동안)에 seenRef를 초기화하면, 뒤이어 도착하는 진짜 첫 스냅샷이 전부
    // "새 메시지"로 오인되어 기존 안읽은 대화들이 한꺼번에 토스트로 뜹니다.
    // 그래서 loading이 처음 false가 되는 시점(=진짜 첫 스냅샷)까지 기다립니다.
    if (loading) return;
    if (seenRef.current === null) {
      seenRef.current = new Map(chats.map((c) => [c.id, c.lastMessageAt]));
      return;
    }
    const seen = seenRef.current;
    for (const c of chats) {
      const prev = seen.get(c.id) ?? 0;
      if (c.unread && c.lastMessageAt > prev) {
        const onThisChat = pathname === `/chat/${c.id}`;
        if (!onThisChat) {
          toast(c.name, {
            description: c.lastMessage,
            icon: <MessageCircle className="size-4" />,
            action: {
              label: "보기",
              onClick: () => router.push(`/chat/${c.id}`),
            },
          });
        }
      }
      seen.set(c.id, c.lastMessageAt);
    }
  }, [chats, loading, pathname, router]);

  return null;
}
