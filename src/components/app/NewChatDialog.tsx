"use client";

import * as React from "react";
import { Check, MessageCircle, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/groupware/data";
import { avatarStyle } from "@/lib/groupware/ui";
import { createGroupChat, ensureDirectChat } from "@/lib/groupware/hooks";

const modalInput =
  "h-9.5 w-full rounded-[9px] border border-border bg-secondary px-3 text-[13px] outline-none transition-colors focus:border-ring focus:bg-card";

export function NewChatDialog({
  people,
  meUid,
  meName,
  onClose,
  onCreated,
}: {
  people: Person[];
  meUid: string;
  meName: string;
  onClose: () => void;
  onCreated: (chatId: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [groupName, setGroupName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const candidates = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return people
      .filter((p) => p.id !== meUid && !p.placeholder)
      .filter(
        (p) =>
          !query || (p.name + p.role + p.dept).toLowerCase().includes(query),
      )
      .slice(0, 40);
  }, [people, meUid, q]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedPeople = people.filter((p) => selected.has(p.id));
  const isGroup = selected.size >= 2;

  const submit = async () => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const me = { uid: meUid, name: meName };
      const chatId = isGroup
        ? await createGroupChat(
            me,
            selectedPeople.map((p) => ({ uid: p.id, name: p.name })),
            groupName,
          )
        : await ensureDirectChat(me, {
            uid: selectedPeople[0].id,
            name: selectedPeople[0].name,
          });
      onCreated(chatId);
    } catch {
      setError("대화방을 만들지 못했습니다. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[78vh] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-5 pb-3.5 pt-4.5">
          <div className="flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.015em]">
              새 채팅
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              1명을 고르면 1:1, 2명 이상이면 그룹 채팅이 됩니다
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 p-3.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름, 직급, 부서로 검색"
              className={cn(modalInput, "pl-9")}
            />
          </div>

          {selectedPeople.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedPeople.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className="flex items-center gap-1 rounded-full bg-[#eef2ff] py-1 pl-1 pr-2 text-[11.5px] font-semibold text-[#4338ca] hover:bg-[#e0e7ff]"
                >
                  <span style={avatarStyle(p.name.charAt(0), 18)}>
                    {p.name.charAt(0)}
                  </span>
                  {p.name}
                  <X className="size-3" />
                </button>
              ))}
            </div>
          )}

          {isGroup && (
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="그룹 이름 (선택, 비우면 참여자 이름으로 표시)"
              className={modalInput}
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-2">
          {candidates.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[12.5px] text-muted-foreground">
              일치하는 구성원이 없습니다
            </div>
          )}
          {candidates.map((p) => {
            const on = selected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-secondary"
              >
                <span style={avatarStyle(p.name.charAt(0), 30)}>
                  {p.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold">
                    {p.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      {p.role}
                    </span>
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {p.dept}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    on
                      ? "border-primary bg-primary text-white"
                      : "border-[#cbd5e1] text-transparent",
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 border-t border-[#eef1f5] px-4 py-3">
          {error && (
            <span className="text-[11.5px] text-destructive">{error}</span>
          )}
          <button
            onClick={submit}
            disabled={selected.size === 0 || busy}
            className={cn(
              "ml-auto flex h-9.5 items-center gap-1.5 rounded-[10px] px-4 text-[13px] font-semibold transition-colors",
              selected.size === 0 || busy
                ? "cursor-not-allowed bg-[#f1f5f9] text-muted-foreground"
                : "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover",
            )}
          >
            {isGroup ? <Users className="size-4" /> : <MessageCircle className="size-4" />}
            {busy ? "만드는 중…" : isGroup ? "그룹 채팅 시작" : "대화 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}
