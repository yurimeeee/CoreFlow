"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CircleX,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Printer,
} from "lucide-react";
import { DETAIL_ATTACHMENTS } from "@/lib/groupware/data";
import { useApprovalDoc } from "@/lib/groupware/hooks";
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
  const no = decodeURIComponent(params.id ?? "EX-2026-0912");
  const { doc, loading, setStatus } = useApprovalDoc(no);

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
          문서 목록으로
        </Link>
      </div>
    );
  }

  const approved = doc.status === "Approved";
  const line = (doc.line ?? []).map((l, i) =>
    i === (doc.line?.length ?? 0) - 1
      ? { ...l, state: approved ? "승인" : l.state, done: approved || l.done }
      : l,
  );
  const rows = doc.rows ?? [];
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const isExpense = doc.type === "지출" && rows.length > 0;

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[13px] border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
        <Link
          href="/approval"
          className="flex h-8.5 items-center gap-1.5 rounded-[9px] border border-border bg-card pl-2.5 pr-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
        >
          <ArrowLeft className="size-3.5" />
          문서 목록
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11.5px] text-muted-foreground">
              {doc.no}
            </span>
            <span
              style={pill(
                approved ? "#f0fdf4" : "#fff7ed",
                approved ? "#15803d" : "#c2410c",
              )}
            >
              {approved ? "완결" : doc.status === "Rejected" ? "반려" : "결재 대기"}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[14.5px] font-bold tracking-[-0.02em]">
            {doc.title}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary">
            <Download className="size-3.5" />
            PDF
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary">
            <Printer className="size-3.5" />
            인쇄
          </button>
          <button
            onClick={() => setStatus("Rejected")}
            className="flex h-9 items-center gap-1.5 rounded-[9px] border border-[#fecaca] bg-card px-3.5 text-[12.5px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2]"
          >
            <CircleX className="size-3.5" />
            반려
          </button>
          <button
            onClick={() => setStatus("Approved")}
            className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover"
          >
            <Check className="size-3.5" strokeWidth={2.4} />
            승인
          </button>
        </div>
      </div>

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
              NEXTCORE
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

          {isExpense && (
            <div>
              <div className="mb-2 text-[13px] font-semibold">첨부 파일</div>
              <div className="flex flex-col gap-1.5">
                {DETAIL_ATTACHMENTS.map((f) => (
                  <div
                    key={f.name}
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {doc.comments && doc.comments.length > 0 && (
            <div>
              <div className="mb-2.5 text-[13px] font-semibold">결재 의견</div>
              <div className="flex flex-col gap-2">
                {doc.comments.map((c) => (
                  <div
                    key={c.name}
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
                        </span>
                      </div>
                      <div className="mt-1.5 text-[12.5px] leading-[1.65] text-secondary-foreground">
                        {c.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </GwCard>
    </div>
  );
}
