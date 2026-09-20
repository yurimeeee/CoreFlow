"use client";

import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";

export default function ChatIndexPage() {
  return (
    <EmptyState
      className="flex flex-1 items-center justify-center"
      icon={<MessageCircle className="size-7" />}
      title="대화를 선택해주세요"
      desc="왼쪽 목록에서 대화를 고르거나, 새 채팅을 눌러 동료와 1:1 또는 그룹 채팅을 시작해보세요."
    />
  );
}
