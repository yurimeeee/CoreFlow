"use client";

import * as React from "react";
import { PenSquare, Save, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTICE_CAT_COLORS } from "@/lib/groupware/data";

export const COMPOSE_CATEGORIES = Object.keys(NOTICE_CAT_COLORS);

export type ComposeInput = { cat: string; title: string; body: string; pinned: boolean };
export type ComposeState = ComposeInput & { id?: string };

const composeInput =
  "h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

/**
 * 공지 작성/편집 모달.
 * - variant "compose"(기본): 새로 쓰거나 임시저장 글을 이어 쓸 때 — "임시저장"/"공지 등록" 두 버튼
 * - variant "edit-published": 이미 게시된 공지를 수정할 때 — 저장 버튼 하나만, draft 개념 없음
 */
export function ComposeModal({
  initial,
  variant = "compose",
  onClose,
  onSubmit,
}: {
  initial: ComposeState;
  variant?: "compose" | "edit-published";
  onClose: () => void;
  onSubmit: (input: ComposeInput, draft: boolean) => Promise<void>;
}) {
  const isEdit = !!initial.id;
  const isEditPublished = variant === "edit-published";
  const [cat, setCat] = React.useState(initial.cat || COMPOSE_CATEGORIES[0] || "경영");
  const [title, setTitle] = React.useState(initial.title);
  const [body, setBody] = React.useState(initial.body);
  const [pinned, setPinned] = React.useState(initial.pinned);
  const [saving, setSaving] = React.useState<null | "draft" | "publish">(null);
  const [error, setError] = React.useState<string | null>(null);

  const valid = title.trim().length > 0;

  const submit = async (draft: boolean) => {
    if (!valid || saving) return;
    setSaving(draft ? "draft" : "publish");
    setError(null);
    try {
      await onSubmit({ cat, title: title.trim(), body: body.trim(), pinned }, draft);
    } catch {
      setError("저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#eef2ff] text-primary">
            <PenSquare className="size-4" />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.015em]">
              {isEditPublished ? "공지 수정" : isEdit ? "임시저장 공지 편집" : "공지 작성"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {isEditPublished
                ? "저장하면 공지 내용이 바로 반영됩니다"
                : isEdit
                  ? "게시하기 전까지는 나에게만 보입니다"
                  : "임시저장하면 나에게만 보이고, 게시하면 전사에 바로 알림이 갑니다"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4"
        >
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                카테고리
              </div>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className={composeInput}
              >
                {COMPOSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                제목<span className="ml-0.5 text-[#e11d48]">*</span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 2분기 경영실적 공유 안내"
                className={composeInput}
                required
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
              본문
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="공지 내용을 입력하세요"
              className={cn(composeInput, "h-auto resize-none py-2")}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-border p-3 text-[12.5px]">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="flex-1">
              <span className="font-semibold">필독 공지로 상단 고정</span>
              <span className="ml-1.5 text-muted-foreground">
                목록 상단의 필독 공지 카드로 표시됩니다
              </span>
            </span>
          </label>
        </form>

        {error && (
          <p className="border-t border-[#fecaca] bg-[#fef2f2] px-5 py-2 text-[12px] font-semibold text-[#b91c1c]">
            {error}
          </p>
        )}

        <div className="flex gap-2 border-t border-[#eef1f5] bg-secondary px-5 py-3.5">
          <button
            onClick={onClose}
            className="h-10 flex-1 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-[#f1f5f9]"
          >
            취소
          </button>
          {!isEditPublished && (
            <button
              onClick={() => submit(true)}
              disabled={!valid || !!saving}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card text-[13px] font-semibold text-secondary-foreground hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="size-3.5" />
              {saving === "draft" ? "저장 중…" : "임시저장"}
            </button>
          )}
          <button
            onClick={() => submit(false)}
            disabled={!valid || !!saving}
            className={cn(
              "flex h-10 flex-[2] items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold transition-colors",
              !valid || saving
                ? "cursor-not-allowed bg-[#f1f5f9] text-muted-foreground"
                : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
            )}
          >
            {isEditPublished ? (
              <Save className="size-3.5" />
            ) : (
              <Send className="size-3.5" />
            )}
            {isEditPublished
              ? saving === "publish"
                ? "저장 중…"
                : "저장하기"
              : saving === "publish"
                ? "게시하는 중…"
                : "공지 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
