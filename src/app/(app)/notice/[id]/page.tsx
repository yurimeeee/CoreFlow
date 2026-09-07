"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Paperclip, Pin } from "lucide-react";
import { NOTICE_CAT_COLORS } from "@/lib/groupware/data";
import { useNoticeDoc } from "@/lib/groupware/hooks";
import { pill } from "@/lib/groupware/ui";
import { GwCard } from "@/components/app/primitives";

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const { notice, loading } = useNoticeDoc(id);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="mx-auto max-w-[900px] py-16 text-center">
        <p className="text-sm text-muted-foreground">
          공지를 찾을 수 없습니다: {id}
        </p>
        <Link
          href="/notice"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          공지 목록으로
        </Link>
      </div>
    );
  }

  const c = NOTICE_CAT_COLORS[notice.cat] ?? ["#f1f5f9", "#475569"];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link
        href="/notice"
        className="flex h-8.5 w-fit items-center gap-1.5 rounded-[9px] border border-border bg-card pl-2.5 pr-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
      >
        <ArrowLeft className="size-3.5" />
        공지 목록
      </Link>

      <GwCard className="flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col gap-3 border-b border-[#eef1f5] pb-5">
          <div className="flex items-center gap-2">
            <span style={pill(c[0], c[1])}>{notice.cat}</span>
            {notice.pinned && (
              <span className="flex items-center gap-1 text-[11.5px] font-semibold text-[#b91c1c]">
                <Pin className="size-3" />
                필독
              </span>
            )}
          </div>
          <h1 className="text-[22px] font-bold leading-snug tracking-[-0.025em]">
            {notice.title}
          </h1>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>{notice.author}</span>
            <span>·</span>
            <span>{notice.date}</span>
            <span>·</span>
            <span>조회 {notice.views}</span>
          </div>
        </div>

        <div className="whitespace-pre-wrap text-[13.5px] leading-[1.8] text-secondary-foreground">
          {notice.body || "내용이 없습니다."}
        </div>

        {notice.attach && (
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-secondary px-3 py-2.5 text-[12.5px] text-muted-foreground">
            <Paperclip className="size-3.5" />
            첨부파일이 있는 공지입니다
          </div>
        )}
      </GwCard>
    </div>
  );
}
