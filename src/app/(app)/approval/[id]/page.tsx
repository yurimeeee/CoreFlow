"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Check,
  CircleX,
  Download,
  FileEdit,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import {
  isPendingApprover,
  useApprovalDoc,
  useCurrentUser,
  useWorkspace,
} from "@/lib/groupware/hooks";
import { useAuthUser } from "@/hooks/useAuthUser";
import { avatarStyle, pill } from "@/lib/groupware/ui";
import { GwCard } from "@/components/app/primitives";

const KIND_PILL: Record<string, [string, string]> = {
  기안: ["#f1f5f9", "#475569"],
  결재: ["#eef2ff", "#4338ca"],
  합의: ["#fff7ed", "#c2410c"],
  참조: ["#f0fdf4", "#15803d"],
};

const won = (v: number) => v.toLocaleString("ko-KR") + "원";

export default function ApprovalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const no = decodeURIComponent(params.id ?? "EX-2026-0912");
  const {
    doc,
    loading,
    setStatus,
    addComment,
    updateComment,
    removeComment,
    cancelApproval,
  } = useApprovalDoc(no);
  const { data: workspace } = useWorkspace();
  const me = useCurrentUser();
  const { profile } = useAuthUser();
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const orgName = (workspace.name || "NEXTCORE").toUpperCase();
  const [opinion, setOpinion] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [decideError, setDecideError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingBody, setEditingBody] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);

  const decide = async (status: "Approved" | "Rejected") => {
    setBusy(true);
    setDecideError(null);
    try {
      if (opinion.trim()) await addComment(opinion.trim());
      await setStatus(status);
      setOpinion("");
    } catch (e) {
      setDecideError(e instanceof Error ? e.message : "처리할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  };

  const postOpinion = async () => {
    if (!opinion.trim()) return;
    setBusy(true);
    try {
      await addComment(opinion.trim());
      setOpinion("");
    } finally {
      setBusy(false);
    }
  };

  const startEditComment = (id: string, body: string) => {
    setEditingId(id);
    setEditingBody(body);
  };

  const saveEditComment = async () => {
    if (!editingId || !editingBody.trim()) return;
    setBusy(true);
    try {
      await updateComment(editingId, editingBody.trim());
      setEditingId(null);
      setEditingBody("");
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!window.confirm("이 의견을 삭제하시겠어요?")) return;
    await removeComment(id);
  };

  const cancel = async () => {
    if (
      !window.confirm(
        "이 문서를 취소하시겠어요? 취소하면 문서가 삭제되어 되돌릴 수 없습니다.",
      )
    )
      return;
    setCancelling(true);
    setDecideError(null);
    try {
      await cancelApproval();
      router.push("/approval");
    } catch (e) {
      setDecideError(e instanceof Error ? e.message : "취소하지 못했습니다.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-[980px] py-16 text-center">
        <p className="text-sm text-muted-foreground">
          문서를 찾을 수 없습니다: {no}
        </p>
        <Link
          href="/approval"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" />
        </Link>
      </div>
    );
  }

  const approved = doc.status === "Approved";
  const resolved = approved || doc.status === "Rejected";
  const isDraft = doc.bucket === "drafted";
  const isAuthor = !!me.uid && doc.authorUid === me.uid;
  const pendingStep =
    (doc.line ?? []).find((l) => l.kind !== "기안" && !l.done) ?? null;
  const isMyTurn = isPendingApprover(doc, me);
  const line = (doc.line ?? []).map((l, i) =>
    i === (doc.line?.length ?? 0) - 1
      ? { ...l, state: approved ? "승인" : l.state, done: approved || l.done }
      : l,
  );
  const rows = doc.rows ?? [];
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const isExpense = doc.type === "지출" && rows.length > 0;
  const attachments = doc.attachments ?? [];

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[13px] border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
        <Link
          href="/approval"
          className="flex h-8.5 items-center gap-1.5 rounded-[9px] border border-border bg-card pl-2.5 pr-2.5 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
        >
          <ArrowLeft className="size-3.5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11.5px] text-muted-foreground">
              {doc.no}
            </span>
            <span
              style={pill(
                approved ? "#f0fdf4" : isDraft ? "#f1f5f9" : "#fff7ed",
                approved ? "#15803d" : isDraft ? "#475569" : "#c2410c",
              )}
            >
              {approved
                ? "완결"
                : doc.status === "Rejected"
                  ? "반려"
                  : isDraft
                    ? "임시저장"
                    : "결재 대기"}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[14.5px] font-bold tracking-[-0.02em]">
            {doc.title}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button
            onClick={() => window.print()}
            className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
          >
            <Download className="size-3.5" />
            PDF
          </button>
          <button
            onClick={() => window.print()}
            className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
          >
            <Printer className="size-3.5" />
            인쇄
          </button>
          {isAuthor && !resolved && (
            <button
              onClick={cancel}
              disabled={cancelling}
              className="flex h-9 items-center gap-1.5 rounded-[9px] border border-[#fecaca] bg-card px-3 text-[12.5px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-50"
            >
              <Ban className="size-3.5" />
              {cancelling ? "취소하는 중…" : isDraft ? "임시저장 삭제" : "기안 취소"}
            </button>
          )}
          {isDraft ? (
            <Link
              href={`/approval/new?edit=${encodeURIComponent(doc.no)}`}
              className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
            >
              <FileEdit className="size-3.5" />
              이어서 작성
            </Link>
          ) : resolved ? (
            <span
              style={pill(
                approved ? "#f0fdf4" : "#fef2f2",
                approved ? "#15803d" : "#b91c1c",
              )}
              className="flex h-9 items-center px-3.5 text-[12.5px] font-semibold"
            >
              {approved ? "승인 완료된 문서입니다" : "반려된 문서입니다"}
            </span>
          ) : isMyTurn ? (
            <>
              <button
                onClick={() => decide("Rejected")}
                disabled={busy}
                className="flex h-9 items-center gap-1.5 rounded-[9px] border border-[#fecaca] bg-card px-3.5 text-[12.5px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-50"
              >
                <CircleX className="size-3.5" />
                반려
              </button>
              <button
                onClick={() => decide("Approved")}
                disabled={busy}
                className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover disabled:opacity-50"
              >
                <Check className="size-3.5" strokeWidth={2.4} />
                승인
              </button>
            </>
          ) : (
            <span className="flex h-9 items-center rounded-[9px] bg-secondary px-3.5 text-[12.5px] font-semibold text-muted-foreground">
              {pendingStep
                ? `${pendingStep.name}님의 결재를 기다리는 중입니다`
                : "결재선이 지정되지 않았습니다"}
            </span>
          )}
        </div>
      </div>
      {decideError && (
        <p className="rounded-[10px] border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#b91c1c]">
          {decideError}
        </p>
      )}

      {line.length > 0 && (
        <GwCard className="p-4.5">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold tracking-[-0.01em]">
              결재란
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {line.filter((l) => l.done).length} / {line.length} 단계 완료
            </span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
            {line.map((a, i) => {
              const kc = KIND_PILL[a.kind] ?? ["#f1f5f9", "#475569"];
              return (
                <div
                  key={i}
                  className="flex w-[122px] shrink-0 flex-col rounded-[11px] border bg-card px-2 pb-2.5 pt-2.5"
                  style={{ borderColor: a.done ? "#e0e7ff" : "#eef1f5" }}
                >
                  <span
                    className="self-center rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: kc[0], color: kc[1] }}
                  >
                    {a.kind}
                  </span>
                  <div
                    className="mt-2 flex size-14 items-center justify-center self-center rounded-[10px]"
                    style={{
                      border: a.done ? "1px solid #e0e7ff" : "1px dashed #cbd5e1",
                      background: a.done ? "#fbfbff" : "#fbfcfe",
                    }}
                  >
                    {a.done && (
                      <span className="flex size-10 rotate-[-9deg] items-center justify-center rounded-full border-2 border-[#dc2626] text-base font-bold text-[#dc2626] opacity-90">
                        {a.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-center text-xs font-semibold">
                    {a.name}
                  </div>
                  <div className="mt-0.5 text-center text-[11px] text-muted-foreground">
                    {a.role}
                  </div>
                  <span
                    className="mt-2 self-center"
                    style={pill(
                      a.done ? "#f0fdf4" : "#f8fafc",
                      a.done ? "#15803d" : "#94a3b8",
                    )}
                  >
                    {a.state}
                  </span>
                  <div className="mt-1.5 min-h-3 text-center text-[10px] tabular-nums text-[#cbd5e1]">
                    {a.at}
                  </div>
                </div>
              );
            })}
          </div>
        </GwCard>
      )}

      <GwCard className="shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-6 p-6 sm:px-8 sm:pb-8 sm:pt-7">
          <div className="border-b-2 border-[#0f172a] pb-4 text-center">
            <div className="text-[11.5px] font-semibold tracking-[0.14em] text-muted-foreground">
              {orgName}
            </div>
            <div className="mt-2 text-[27px] font-bold tracking-[0.22em]">
              {isExpense ? "지출결의서" : doc.title}
            </div>
          </div>

          {doc.meta && doc.meta.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] overflow-hidden rounded-[10px] border border-border">
              {doc.meta.map((m) => (
                <div key={m.label} className="flex border-t border-[#eef1f5]">
                  <div className="w-[100px] shrink-0 bg-secondary px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                    {m.label}
                  </div>
                  <div className="min-w-0 flex-1 truncate px-3 py-2.5 text-[12.5px]">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isExpense && (
            <div>
              <div className="mb-2.5 text-[13px] font-semibold">지출 내역</div>
              <div className="overflow-hidden rounded-[10px] border border-border">
                <div className="flex border-b border-[#eef1f5] bg-secondary px-3.5 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
                  <div className="w-[110px] shrink-0">사용일자</div>
                  <div className="min-w-[130px] flex-1">내역</div>
                  <div className="w-[120px] shrink-0 text-right">금액</div>
                  <div className="w-20 shrink-0 text-center">증빙</div>
                </div>
                {rows.map((r) => (
                  <div
                    key={r.desc}
                    className="flex items-center border-b border-[#f1f5f9] px-3.5 py-2.5 text-[12.5px]"
                  >
                    <div className="w-[110px] shrink-0 tabular-nums text-secondary-foreground">
                      {r.date}
                    </div>
                    <div className="min-w-[130px] flex-1">{r.desc}</div>
                    <div className="w-[120px] shrink-0 text-right font-medium tabular-nums">
                      {won(r.amount)}
                    </div>
                    <div className="flex w-20 shrink-0 justify-center">
                      <span
                        style={pill(
                          r.receipt === "첨부" ? "#f0fdf4" : "#fff7ed",
                          r.receipt === "첨부" ? "#15803d" : "#c2410c",
                        )}
                      >
                        {r.receipt}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center bg-[#f5f6ff] px-3.5 py-3">
                  <div className="flex-1 text-[12.5px] font-semibold text-[#4338ca]">
                    총 합계액
                  </div>
                  <div className="text-base font-bold tracking-[-0.02em] tabular-nums text-[#3730a3]">
                    {won(total)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {doc.reason && (
            <div>
              <div className="mb-2 text-[13px] font-semibold">기안 사유</div>
              <div className="rounded-[10px] border border-[#eef1f5] bg-secondary p-3.5 text-[12.5px] leading-[1.75] text-secondary-foreground">
                {doc.reason}
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-semibold">첨부 파일</div>
              <div className="flex flex-col gap-1.5">
                {attachments.map((f) => (
                  <a
                    key={f.name}
                    href={f.url || undefined}
                    target={f.url ? "_blank" : undefined}
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-[10px] border border-border px-3 py-2.5 transition-colors hover:border-ring hover:bg-secondary"
                  >
                    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-[#f1f5f9]">
                      {f.kind === "pdf" ? (
                        <FileText className="size-[15px] text-muted-foreground" />
                      ) : (
                        <ImageIcon className="size-[15px] text-muted-foreground" />
                      )}
                    </span>
                    <span className="flex-1 truncate text-[12.5px]">
                      {f.name}
                    </span>
                    <span className="tabular-nums text-[11.5px] text-muted-foreground">
                      {f.size}
                    </span>
                    <Download className="size-3.5 text-[#cbd5e1]" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2.5 text-[13px] font-semibold">
              결재 의견
              {doc.comments && doc.comments.length > 0 && (
                <span className="ml-1.5 text-[11.5px] font-medium text-muted-foreground">
                  {doc.comments.length}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {(doc.comments ?? []).map((c, i) => {
                const mine = !!me.uid && c.uid === me.uid;
                const canDelete = mine || isAdmin;
                const editing = editingId === c.id;
                return (
                  <div
                    key={c.id || `${c.name}-${i}`}
                    className="flex gap-2.5 rounded-[10px] border border-border p-3"
                  >
                    <span style={avatarStyle(c.name.charAt(0), 30)}>
                      {c.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] font-semibold">
                          {c.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {c.role}
                        </span>
                        <span className="ml-auto text-[11px] tabular-nums text-[#cbd5e1]">
                          {c.at}
                          {c.edited && " · 수정됨"}
                        </span>
                        {mine && !editing && (
                          <button
                            type="button"
                            onClick={() => startEditComment(c.id, c.body)}
                            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                            aria-label="의견 수정"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                        {canDelete && !editing && (
                          <button
                            type="button"
                            onClick={() => deleteComment(c.id)}
                            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                            aria-label="의견 삭제"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                      {editing ? (
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          <textarea
                            value={editingBody}
                            onChange={(e) => setEditingBody(e.target.value)}
                            rows={2}
                            autoFocus
                            className="w-full resize-none rounded-[8px] border border-ring bg-card px-2.5 py-2 text-[12.5px] leading-relaxed focus-visible:outline-none"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="flex h-7 items-center gap-1 rounded-[7px] px-2.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-secondary"
                            >
                              <X className="size-3" />
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={saveEditComment}
                              disabled={busy || !editingBody.trim()}
                              className="flex h-7 items-center gap-1 rounded-[7px] bg-primary px-2.5 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[12.5px] leading-[1.65] text-secondary-foreground">
                          {c.body}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {(doc.comments ?? []).length === 0 && (
                <p className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">
                  아직 등록된 의견이 없습니다
                </p>
              )}
              <div className="mt-1 flex flex-col gap-2 rounded-[10px] border border-border bg-secondary p-3">
                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  rows={2}
                  placeholder="결재 의견을 입력하세요. 승인·반려 시 함께 기록됩니다."
                  className="w-full resize-none rounded-[8px] border border-border bg-card px-2.5 py-2 text-[12.5px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex justify-end">
                  <button
                    onClick={postOpinion}
                    disabled={busy || !opinion.trim()}
                    className="h-8 rounded-[8px] border border-border bg-card px-3 text-[12px] font-semibold text-secondary-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    의견만 등록
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GwCard>
    </div>
  );
}
