"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  Clock4,
  FileBarChart,
  FileSignature,
  Italic,
  List,
  ListOrdered,
  Lock,
  Palmtree,
  Paperclip,
  Plus,
  Receipt,
  Save,
  Send,
  ShoppingCart,
  Table,
  Underline,
  Upload,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DRAFT_APPROVAL_LINE,
  DRAFT_META,
  EXPENSE_ROWS,
  FORM_TEMPLATES,
  PURCHASE_ROWS,
} from "@/lib/groupware/data";
import { pill } from "@/lib/groupware/ui";
import { GwCard } from "@/components/app/primitives";

const FORM_ICONS: Record<string, React.ElementType> = {
  지출결의서: Receipt,
  휴가신청서: Palmtree,
  품의서: FileSignature,
  업무보고서: FileBarChart,
  "근무시간 변경 신청": Clock4,
  구매요청서: ShoppingCart,
};

const won = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;
const fmt = (v: number) => v.toLocaleString("ko-KR") + "원";

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
            value === o
              ? "border-primary bg-primary text-white"
              : "border-border bg-card text-secondary-foreground hover:bg-secondary",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

const inputCls =
  "h-9.5 w-full rounded-[9px] border border-border bg-card px-3 text-[13px] focus-visible:border-ring focus-visible:outline-none";
const areaCls =
  "w-full rounded-[10px] border border-border bg-card p-3 text-[13px] leading-[1.65] focus-visible:border-ring focus-visible:outline-none";
const labelCls = "mb-1.5 block text-[11.5px] font-semibold text-muted-foreground";

export default function DraftPage() {
  const [form, setForm] = React.useState("지출결의서");
  const [title, setTitle] = React.useState("");
  const [sec, setSec] = React.useState("일반");
  const [retention, setRetention] = React.useState("5년");
  const [leaveKind, setLeaveKind] = React.useState("연차");
  const [reportKind, setReportKind] = React.useState("주간");
  const [shift, setShift] = React.useState("08:00 – 17:00");
  const [text, setText] = React.useState<Record<string, string>>({});
  const [expense, setExpense] = React.useState(EXPENSE_ROWS);
  const [purchase, setPurchase] = React.useState(PURCHASE_ROWS);

  const t = (k: string) => text[k] ?? "";
  const setT = (k: string, v: string) => setText((p) => ({ ...p, [k]: v }));
  const expenseTotal = expense.reduce((a, r) => a + won(r.amount), 0);
  const purchaseTotal = purchase.reduce(
    (a, r) => a + won(r.qty) * won(r.price),
    0,
  );

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3.5 rounded-[13px] border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
        <Link
          href="/approval"
          className="flex h-8.5 items-center gap-1.5 rounded-[9px] border border-border bg-card pl-2.5 pr-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
        >
          <ArrowLeft className="size-3.5" />
          결재 목록
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold tracking-[-0.02em]">
            {form}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {FORM_TEMPLATES.find((f) => f.name === form)?.desc}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary">
            <Save className="size-3.5" />
            임시저장
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary">
            <UserCheck className="size-3.5" />
            결재선 설정
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover">
            <Send className="size-3.5" />
            결재 요청하기
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FORM_TEMPLATES.map((f) => {
          const Icon = FORM_ICONS[f.name];
          const active = form === f.name;
          return (
            <button
              key={f.name}
              onClick={() => setForm(f.name)}
              className={cn(
                "flex h-8.5 items-center gap-1.5 rounded-[9px] border px-3 text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-secondary-foreground hover:bg-secondary",
              )}
            >
              <Icon className="size-3.5" />
              {f.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <GwCard className="min-w-[280px] flex-[1_1_300px] p-4.5">
          <div className="text-[12.5px] font-semibold tracking-[-0.01em]">
            기안 정보
          </div>
          <div className="mt-2.5 flex flex-col">
            {DRAFT_META.map((m) => (
              <div
                key={m.label}
                className="flex items-center gap-2.5 border-t border-[#f1f5f9] py-2.5 text-[12.5px]"
              >
                <span className="w-[76px] shrink-0 text-muted-foreground">
                  {m.label}
                </span>
                <span className="flex-1 truncate font-medium">{m.value}</span>
              </div>
            ))}
          </div>
        </GwCard>

        <GwCard className="min-w-[300px] flex-[1.4_1_400px] p-4.5">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold tracking-[-0.01em]">
              결재선
            </span>
            <button className="ml-auto flex h-7 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[11.5px] font-semibold text-primary hover:bg-[#f5f6ff]">
              <Plus className="size-3" strokeWidth={2.2} />
              결재선 변경
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
            {DRAFT_APPROVAL_LINE.map((a, i) => {
              const kc =
                {
                  기안: ["#f1f5f9", "#475569"],
                  결재: ["#eef2ff", "#4338ca"],
                  합의: ["#fff7ed", "#c2410c"],
                  참조: ["#f0fdf4", "#15803d"],
                }[a.kind] ?? ["#f1f5f9", "#475569"];
              const done = a.state === "기안 완료";
              return (
                <div
                  key={i}
                  className="flex w-[118px] shrink-0 flex-col rounded-[11px] border px-2 pb-2.5 pt-2.5"
                  style={{
                    borderColor: done ? "#e0e7ff" : "#eef1f5",
                    background: done ? "#fbfbff" : "#fff",
                  }}
                >
                  <span
                    className="self-center rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: kc[0], color: kc[1] }}
                  >
                    {a.kind}
                  </span>
                  <div
                    className="mt-2 flex size-[54px] items-center justify-center self-center rounded-[10px] text-lg font-semibold text-primary"
                    style={{
                      border: done ? "1px solid #4f46e5" : "1px dashed #cbd5e1",
                      background: done ? "#eef2ff" : "#fbfcfe",
                    }}
                  >
                    {a.mark}
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
                      done ? "#f0fdf4" : "#f8fafc",
                      done ? "#15803d" : "#94a3b8",
                    )}
                  >
                    {a.state}
                  </span>
                </div>
              );
            })}
          </div>
        </GwCard>
      </div>

      <GwCard className="shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#eef1f5] px-3.5 py-2.5">
          {[Bold, Italic, Underline, List, ListOrdered, Table, Paperclip].map(
            (Icon, i) => (
              <button
                key={i}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-secondary-foreground hover:bg-secondary",
                  i === 5 && "ml-1.5",
                )}
              >
                <Icon className="size-[15px]" />
              </button>
            ),
          )}
          <span className="ml-auto text-[11.5px] text-[#cbd5e1]">
            자동 저장됨 · 09:41
          </span>
        </div>

        <div className="flex flex-col gap-5 p-6 sm:px-7 sm:pb-7">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문서 제목을 입력하세요"
            className="w-full border-0 border-b border-[#eef1f5] pb-3 text-2xl font-bold tracking-[-0.03em] focus-visible:outline-none"
          />

          <div className="flex flex-wrap gap-5">
            <div>
              <div className={labelCls}>보안 등급</div>
              <Chips
                options={["일반", "보안", "극비"]}
                value={sec}
                onChange={setSec}
              />
            </div>
            <div>
              <div className={labelCls}>보존 연한</div>
              <Chips
                options={["1년", "3년", "5년", "영구"]}
                value={retention}
                onChange={setRetention}
              />
            </div>
          </div>

          {form === "지출결의서" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">지출 내역</span>
                <button
                  onClick={() =>
                    setExpense((p) => [
                      ...p,
                      {
                        id: Date.now(),
                        date: "2026.09.03",
                        desc: "",
                        amount: "0",
                        receipt: "미첨부",
                      },
                    ])
                  }
                  className="ml-auto flex h-7.5 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary"
                >
                  <Plus className="size-3.5" />행 추가
                </button>
              </div>
              <div className="overflow-hidden rounded-[11px] border border-border">
                <div className="flex bg-secondary px-3.5 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
                  <div className="w-[110px] shrink-0">사용일자</div>
                  <div className="min-w-[140px] flex-1">내역</div>
                  <div className="w-[120px] shrink-0 text-right">금액</div>
                  <div className="w-[92px] shrink-0 text-center">증빙</div>
                </div>
                {expense.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center border-b border-[#f1f5f9] px-3.5 py-2"
                  >
                    <div className="w-[110px] shrink-0 text-[12.5px] tabular-nums text-secondary-foreground">
                      {r.date}
                    </div>
                    <div className="min-w-[140px] flex-1 pr-3">
                      <input
                        value={r.desc}
                        onChange={(e) =>
                          setExpense((p) =>
                            p.map((x) =>
                              x.id === r.id
                                ? { ...x, desc: e.target.value }
                                : x,
                            ),
                          )
                        }
                        placeholder="사용 내역"
                        className="h-8 w-full rounded-[7px] border border-transparent bg-transparent px-2 text-[12.5px] focus-visible:border-primary focus-visible:bg-card focus-visible:outline-none"
                      />
                    </div>
                    <div className="w-[120px] shrink-0">
                      <input
                        value={r.amount}
                        onChange={(e) =>
                          setExpense((p) =>
                            p.map((x) =>
                              x.id === r.id
                                ? { ...x, amount: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="h-8 w-full rounded-[7px] border border-transparent bg-transparent px-2 text-right text-[12.5px] tabular-nums focus-visible:border-primary focus-visible:bg-card focus-visible:outline-none"
                      />
                    </div>
                    <div className="flex w-[92px] shrink-0 justify-center">
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
                    {fmt(expenseTotal)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {form === "휴가신청서" && (
            <div className="flex flex-col gap-4">
              <div>
                <div className={labelCls}>휴가 종류</div>
                <Chips
                  options={["연차", "반차", "경조", "병가"]}
                  value={leaveKind}
                  onChange={setLeaveKind}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex-[1_1_180px]">
                  <div className={labelCls}>시작일</div>
                  <div className={cn(inputCls, "flex items-center")}>
                    2026.09.10
                  </div>
                </div>
                <div className="flex-[1_1_180px]">
                  <div className={labelCls}>종료일</div>
                  <div className={cn(inputCls, "flex items-center")}>
                    2026.09.11
                  </div>
                </div>
                <div className="flex-[1_1_160px]">
                  <div className={labelCls}>잔여 연차</div>
                  <div className="flex h-9.5 items-baseline gap-1.5 rounded-[9px] border border-[#e0e7ff] bg-[#f5f6ff] px-3">
                    <span className="text-[15px] font-semibold tabular-nums text-[#3730a3]">
                      10일
                    </span>
                    <span className="text-[11.5px] text-[#6366f1]">
                      신청 후 8일
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <div className={labelCls}>사유</div>
                <textarea
                  value={t("reason")}
                  onChange={(e) => setT("reason", e.target.value)}
                  placeholder="예: 개인 사유 (가족 행사)"
                  className={cn(areaCls, "min-h-[92px]")}
                />
              </div>
            </div>
          )}

          {form === "품의서" && (
            <div className="flex flex-col gap-4">
              <div>
                <div className={labelCls}>품의 목적</div>
                <input
                  value={t("purpose")}
                  onChange={(e) => setT("purpose", e.target.value)}
                  placeholder="예: 개발 서버 증설을 통한 배포 안정성 확보"
                  className={inputCls}
                />
              </div>
              <div>
                <div className={labelCls}>주요 내용</div>
                <textarea
                  value={t("detail")}
                  onChange={(e) => setT("detail", e.target.value)}
                  placeholder="도입 범위, 일정, 수행 방식 등을 작성하세요"
                  className={cn(areaCls, "min-h-[120px]")}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex-[1_1_200px]">
                  <div className={labelCls}>예상 소요 예산</div>
                  <input
                    value={t("budget")}
                    onChange={(e) => setT("budget", e.target.value)}
                    className={cn(inputCls, "text-right tabular-nums")}
                  />
                </div>
                <div className="flex-[2_1_260px]">
                  <div className={labelCls}>기대 효과</div>
                  <input
                    value={t("effect")}
                    onChange={(e) => setT("effect", e.target.value)}
                    placeholder="예: 배포 실패율 30% 감소"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {form === "업무보고서" && (
            <div className="flex flex-col gap-4">
              <div>
                <div className={labelCls}>보고 구분</div>
                <Chips
                  options={["주간", "월간"]}
                  value={reportKind}
                  onChange={setReportKind}
                />
              </div>
              {[
                ["done", "금주 실적", "완료한 업무를 항목별로 작성하세요"],
                ["plan", "차주 계획", "예정 업무와 마일스톤을 작성하세요"],
                ["issue", "이슈 및 건의사항", "지원이 필요한 사항을 작성하세요"],
              ].map(([k, label, ph]) => (
                <div key={k}>
                  <div className={labelCls}>{label}</div>
                  <textarea
                    value={t(k)}
                    onChange={(e) => setT(k, e.target.value)}
                    placeholder={ph}
                    className={cn(areaCls, "min-h-[96px]")}
                  />
                </div>
              ))}
            </div>
          )}

          {form === "근무시간 변경 신청" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-[1_1_220px]">
                  <div className={labelCls}>변경 전 근무 시간대</div>
                  <div className="flex h-9.5 items-center gap-2 rounded-[9px] border border-[#eef1f5] bg-secondary px-3 text-[13px] text-muted-foreground">
                    <Lock className="size-3.5" />
                    09:00 – 18:00 (표준)
                  </div>
                </div>
                <ArrowRight className="mb-2.5 size-4 text-[#cbd5e1]" />
                <div className="flex-[1_1_220px]">
                  <div className={labelCls}>변경 후 근무 시간대</div>
                  <Chips
                    options={[
                      "08:00 – 17:00",
                      "10:00 – 19:00",
                      "재택 (코어 11–16)",
                    ]}
                    value={shift}
                    onChange={setShift}
                  />
                </div>
              </div>
              <div>
                <div className={labelCls}>변경 사유</div>
                <textarea
                  value={t("reason")}
                  onChange={(e) => setT("reason", e.target.value)}
                  placeholder="예: 미주 리전 배포 대응으로 오전 출근 조정 필요"
                  className={cn(areaCls, "min-h-[92px]")}
                />
              </div>
            </div>
          )}

          {form === "구매요청서" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">구매 품목</span>
                <button
                  onClick={() =>
                    setPurchase((p) => [
                      ...p,
                      {
                        id: Date.now(),
                        name: "",
                        spec: "—",
                        qty: "1",
                        price: "0",
                      },
                    ])
                  }
                  className="ml-auto flex h-7.5 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary"
                >
                  <Plus className="size-3.5" />행 추가
                </button>
              </div>
              <div className="overflow-x-auto rounded-[11px] border border-border">
                <div className="flex min-w-[620px] bg-secondary px-3.5 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
                  <div className="min-w-[130px] flex-1">품명</div>
                  <div className="w-[130px] shrink-0">규격</div>
                  <div className="w-[70px] shrink-0 text-right">수량</div>
                  <div className="w-[100px] shrink-0 text-right">단가</div>
                  <div className="w-[110px] shrink-0 text-right">합계</div>
                </div>
                {purchase.map((r) => (
                  <div
                    key={r.id}
                    className="flex min-w-[620px] items-center border-b border-[#f1f5f9] px-3.5 py-2 text-[12.5px]"
                  >
                    <div className="min-w-[130px] flex-1 pr-2.5">
                      <input
                        value={r.name}
                        onChange={(e) =>
                          setPurchase((p) =>
                            p.map((x) =>
                              x.id === r.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="h-8 w-full rounded-[7px] border border-transparent bg-transparent px-2 text-[12.5px] focus-visible:border-primary focus-visible:bg-card focus-visible:outline-none"
                      />
                    </div>
                    <div className="w-[130px] shrink-0 text-muted-foreground">
                      {r.spec}
                    </div>
                    <div className="w-[70px] shrink-0">
                      <input
                        value={r.qty}
                        onChange={(e) =>
                          setPurchase((p) =>
                            p.map((x) =>
                              x.id === r.id
                                ? { ...x, qty: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="h-8 w-full rounded-[7px] border border-transparent bg-transparent px-2 text-right text-[12.5px] tabular-nums focus-visible:border-primary focus-visible:bg-card focus-visible:outline-none"
                      />
                    </div>
                    <div className="w-[100px] shrink-0 text-right tabular-nums text-secondary-foreground">
                      {won(r.price).toLocaleString("ko-KR")}
                    </div>
                    <div className="w-[110px] shrink-0 text-right font-semibold tabular-nums">
                      {fmt(won(r.qty) * won(r.price))}
                    </div>
                  </div>
                ))}
                <div className="flex min-w-[620px] items-center bg-[#f5f6ff] px-3.5 py-3">
                  <div className="flex-1 text-[12.5px] font-semibold text-[#4338ca]">
                    합계 금액
                  </div>
                  <div className="text-base font-bold tracking-[-0.02em] tabular-nums text-[#3730a3]">
                    {fmt(purchaseTotal)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-[#f1f5f9] pt-5">
            <div className="text-[13px] font-semibold">파일 첨부</div>
            <div className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#cbd5e1] bg-secondary p-6 transition-colors hover:border-ring hover:bg-[#f5f6ff]">
              <Upload className="size-4 text-secondary-foreground" />
              <span className="text-[12.5px] font-semibold text-secondary-foreground">
                파일을 여기로 끌어다 놓거나 클릭해 업로드
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                PDF, JPG, XLSX · 파일당 최대 20MB
              </span>
            </div>
          </div>
        </div>
      </GwCard>
    </div>
  );
}
