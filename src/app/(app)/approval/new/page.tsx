"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock4,
  FileBarChart,
  FileSignature,
  HardDrive,
  Loader2,
  Lock,
  Palmtree,
  Paperclip,
  Plus,
  Receipt,
  Save,
  Search,
  Send,
  ShoppingCart,
  Upload,
  X,
} from "lucide-react";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { cn, localDateStr } from "@/lib/utils";
import { firebaseStorage, isFirebaseConfigured } from "@/lib/firebase";
import { LEAVE_TYPES_COUNTED } from "@/lib/groupware/firestore";
import { getGoogleDriveSession, uploadFileToDrive } from "@/lib/googleDrive";
import {
  EXPENSE_ROWS,
  FORM_TEMPLATES,
  PURCHASE_ROWS,
} from "@/lib/groupware/data";
import { avatarStyle, pill } from "@/lib/groupware/ui";
import {
  useApprovalDoc,
  useApprovals,
  useCurrentUser,
  useLeaves,
  useOrgPeople,
} from "@/lib/groupware/hooks";
import { GwCard } from "@/components/app/primitives";

/** 임시저장 폼의 원본 입력 스냅샷 — "이어서 작성" 복원용 */
type DraftFormState = {
  form: string;
  title: string;
  sec: string;
  retention: string;
  leaveKind: string;
  leaveStart: string;
  leaveEnd: string;
  reportKind: string;
  shift: string;
  text: Record<string, string>;
  expense: typeof EXPENSE_ROWS;
  purchase: typeof PURCHASE_ROWS;
  approvers: { uid: string; label: string }[];
};

/** 서식 → 결재 문서 유형 (APPROVAL_TYPE_COLORS 키) */
const FORM_TYPE: Record<string, string> = {
  지출결의서: "지출",
  휴가신청서: "휴가",
  품의서: "품의",
  업무보고서: "보고",
  "근무시간 변경 신청": "인사",
  구매요청서: "품의",
};

const NO_PREFIX: Record<string, string> = {
  지출: "EX",
  휴가: "VC",
  품의: "PR",
  보고: "RP",
  인사: "HR",
};

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
const fmtSize = (b: number) =>
  b < 1024 * 1024
    ? `${Math.max(1, Math.round(b / 1024))} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;
const extKind = (name: string) =>
  /\.(png|jpe?g|gif|webp)$/i.test(name) ? "image" : "pdf";
const todayDot = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

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
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <DraftPageClient />
    </Suspense>
  );
}

function DraftPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editNo = searchParams.get("edit");
  const me = useCurrentUser();
  const { createApproval } = useApprovals();
  const { doc: editDoc, loading: editLoading } = useApprovalDoc(editNo ?? "");
  const { balance: leaveBalance } = useLeaves();
  const { people } = useOrgPeople();

  const [form, setForm] = React.useState("지출결의서");
  const [title, setTitle] = React.useState("");
  const [sec, setSec] = React.useState("일반");
  const [retention, setRetention] = React.useState("5년");
  const [leaveKind, setLeaveKind] = React.useState("연차");
  const [leaveStart, setLeaveStart] = React.useState(() => localDateStr());
  const [leaveEnd, setLeaveEnd] = React.useState(() => localDateStr());
  const leaveDays = Math.max(
    1,
    Math.round(
      (new Date(leaveEnd).getTime() - new Date(leaveStart).getTime()) /
        86_400_000,
    ) + 1,
  );
  // /attendance의 빠른 연차 신청 모달(LeaveRequestModal)과 동일 기준으로 잔여
  // 연차 부족을 검사합니다 — LEAVE_TYPES_COUNTED(연차/반차)에 속하지 않는
  // 경조·병가는 잔여 연차를 차감하지 않으므로 검사 대상에서 제외합니다.
  const leaveOverBalance =
    form === "휴가신청서" &&
    LEAVE_TYPES_COUNTED.includes(leaveKind) &&
    leaveKind !== "반차" &&
    leaveDays > leaveBalance.remaining;
  const [reportKind, setReportKind] = React.useState("주간");
  const [shift, setShift] = React.useState("08:00 – 17:00");
  const [text, setText] = React.useState<Record<string, string>>({});
  const [expense, setExpense] = React.useState(EXPENSE_ROWS);
  const [purchase, setPurchase] = React.useState(PURCHASE_ROWS);
  const [approvers, setApprovers] = React.useState<{ uid: string; label: string }[]>([]);
  const [approverQuery, setApproverQuery] = React.useState("");
  const [approverOpen, setApproverOpen] = React.useState(false);
  const [saving, setSaving] = React.useState<null | "draft" | "submit">(null);
  const [savedNo, setSavedNo] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<
    { id: string; name: string; size: string; url: string; kind: string; drive?: boolean }[]
  >([]);
  const [uploading, setUploading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // ?edit=<no> 로 들어오면 기존 임시저장 문서를 폼에 복원합니다. draftState가
  // 있으면(이 기능 이후 저장된 임시저장) 원본 입력값 그대로, 없으면(레거시
  // 임시저장) 제목·첨부파일만 최선으로 복원합니다. 편집 대상이 아니거나
  // (이미 상신됨) 본인 문서가 아니면 상세 페이지로 돌려보냅니다.
  //
  // 비동기로 도착한 editDoc을 여러 useState에 나눠 반영해야 해서, effect
  // 안에서 한꺼번에 setState하는 대신(리액트 컴파일러 lint가 금지하는
  // 캐스케이드 렌더 패턴) useChatMessages와 같은 "렌더 중 상태 조정" 방식을
  // 씁니다 — editNo가 바뀌거나 문서가 막 로드된 딱 한 번만 조건이 참이 되고,
  // 그 즉시 hydratedFor를 갱신해 다음 렌더부터는 다시 실행되지 않습니다.
  const editReady = !editLoading && !me.loading;
  const editOwned =
    !!editDoc &&
    editDoc.bucket === "drafted" &&
    (!editDoc.authorUid || editDoc.authorUid === me.uid);
  const [hydratedFor, setHydratedFor] = React.useState<string | null>(null);
  if (editNo && editReady && editOwned && hydratedFor !== editNo) {
    setHydratedFor(editNo);
    setSavedNo(editDoc.no);
    setAttachments(
      (editDoc.attachments ?? []).map((f, i) => ({
        id: `${editDoc.no}-${i}`,
        ...f,
      })),
    );
    const ds = editDoc.draftState as Partial<DraftFormState> | undefined;
    if (ds) {
      if (ds.form) setForm(ds.form);
      if (ds.title !== undefined) setTitle(ds.title);
      if (ds.sec) setSec(ds.sec);
      if (ds.retention) setRetention(ds.retention);
      if (ds.leaveKind) setLeaveKind(ds.leaveKind);
      if (ds.leaveStart) setLeaveStart(ds.leaveStart);
      if (ds.leaveEnd) setLeaveEnd(ds.leaveEnd);
      if (ds.reportKind) setReportKind(ds.reportKind);
      if (ds.shift) setShift(ds.shift);
      if (ds.text) setText(ds.text);
      if (ds.expense) setExpense(ds.expense);
      if (ds.purchase) setPurchase(ds.purchase);
      if (ds.approvers) setApprovers(ds.approvers);
    } else {
      setTitle(editDoc.title ?? "");
      setLoadError(
        "이 임시저장 문서는 예전 버전에서 저장되어 제목·첨부파일만 복원했습니다. 나머지 항목을 다시 입력해주세요.",
      );
    }
  }

  // 편집 대상이 없거나(문서 없음) 본인 임시저장이 아니면 상세/목록으로
  // 돌려보냅니다 — 라우팅은 외부(URL) 부작용이라 effect에서 처리합니다.
  const redirectedRef = React.useRef(false);
  React.useEffect(() => {
    if (!editNo || !editReady || editOwned || redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace(
      editDoc ? `/approval/${encodeURIComponent(editDoc.no)}` : "/approval",
    );
  }, [editNo, editReady, editOwned, editDoc, router]);

  const t = (k: string) => text[k] ?? "";
  const setT = (k: string, v: string) => setText((p) => ({ ...p, [k]: v }));
  const expenseTotal = expense.reduce((a, r) => a + won(r.amount), 0);
  const purchaseTotal = purchase.reduce(
    (a, r) => a + won(r.qty) * won(r.price),
    0,
  );

  const authorName = me.role ? `${me.name} ${me.role}` : me.name;
  const docType = FORM_TYPE[form] ?? "보고";

  const approverQ = approverQuery.trim().toLowerCase();
  const approverMatches = approverQ
    ? people
        .filter(
          (p) =>
            p.name.toLowerCase().includes(approverQ) ||
            p.role.toLowerCase().includes(approverQ) ||
            p.dept.toLowerCase().includes(approverQ),
        )
        .filter((p) => !approvers.some((a) => a.uid === p.id))
        .slice(0, 6)
    : [];

  const addApprover = (p: (typeof people)[number]) => {
    const label = `${p.name} ${p.role}`;
    setApprovers((prev) =>
      prev.some((a) => a.uid === p.id) ? prev : [...prev, { uid: p.id, label }],
    );
    setApproverQuery("");
    setApproverOpen(false);
  };

  const buildReason = () => {
    if (form === "휴가신청서")
      return [
        `${leaveKind} · ${leaveStart} ~ ${leaveEnd} (${leaveDays}일)`,
        t("reason").trim(),
      ]
        .filter(Boolean)
        .join("\n\n");
    if (form === "품의서")
      return [
        t("purpose") && `[품의 목적] ${t("purpose")}`,
        t("detail"),
        t("budget") && `예상 소요 예산: ${t("budget")}`,
        t("effect") && `기대 효과: ${t("effect")}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    if (form === "업무보고서")
      return [
        t("done") && `[금주 실적]\n${t("done")}`,
        t("plan") && `[차주 계획]\n${t("plan")}`,
        t("issue") && `[이슈 및 건의사항]\n${t("issue")}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    if (form === "근무시간 변경 신청")
      return [`변경 후 근무 시간대: ${shift}`, t("reason")]
        .filter(Boolean)
        .join("\n\n");
    if (form === "구매요청서")
      return purchase
        .filter((r) => r.name.trim())
        .map(
          (r) =>
            `· ${r.name} — ${won(r.qty)}개 × ${won(r.price).toLocaleString("ko-KR")}원`,
        )
        .join("\n");
    return "";
  };

  const buildRows = () => {
    if (form !== "지출결의서") return undefined;
    const rows = expense
      .filter((r) => r.desc.trim())
      .map((r) => ({
        date: r.date,
        desc: r.desc.trim(),
        amount: won(r.amount),
        receipt: r.receipt,
      }));
    return rows.length ? rows : undefined;
  };

  const buildMeta = () => [
    { label: "문서양식", value: form },
    { label: "기안자", value: authorName },
    { label: "보안등급", value: sec },
    { label: "보존연한", value: retention },
    ...(form === "휴가신청서"
      ? [
          { label: "휴가종류", value: leaveKind },
          { label: "휴가기간", value: `${leaveStart} ~ ${leaveEnd} (${leaveDays}일)` },
        ]
      : []),
    ...(form === "업무보고서" ? [{ label: "보고구분", value: reportKind }] : []),
  ];

  const buildLine = () => {
    const steps = approvers.length ? approvers : [{ uid: "", label: "미지정" }];
    return [
      {
        kind: "기안",
        name: me.name,
        role: me.role || "기안자",
        state: "기안 완료",
        at: "",
        done: true,
        // Firestore는 값이 literal undefined인 필드를 거부합니다 — 로그인
        // 정보가 아직 없거나 결재자를 안 골랐을 때 uid: undefined가 그대로
        // 들어가면 setDoc이 에러 메시지 없이 기안 생성을 통째로 실패시킵니다.
        ...(me.uid ? { uid: me.uid } : {}),
      },
      ...steps.map((a) => ({
        kind: "결재",
        name: a.label,
        role: "결재자",
        state: "대기",
        at: "",
        done: false,
        ...(a.uid ? { uid: a.uid } : {}),
      })),
    ];
  };

  /** "이어서 작성"이 원래 입력값을 그대로 복원할 수 있도록 폼 상태 전체를 스냅샷 */
  const buildDraftState = (): DraftFormState => ({
    form,
    title,
    sec,
    retention,
    leaveKind,
    leaveStart,
    leaveEnd,
    reportKind,
    shift,
    text,
    expense,
    purchase,
    approvers,
  });

  const genNo = () => {
    const d = new Date();
    const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `${NO_PREFIX[docType] ?? "AP"}-${d.getFullYear()}-${mmdd}-${String(d.getTime()).slice(-4)}`;
  };

  const canSave = title.trim().length > 0 && saving === null;

  const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

  const uploadAttachments = async (files: FileList | null) => {
    if (!files?.length) return;
    // 안내 문구("파일당 최대 20MB")만 있고 실제로는 검증하지 않으면 큰
    // 파일이 Storage 업로드를 오래 붙든 채로 조용히 실패하거나 그대로
    // 올라가버립니다 — 업로드 전에 걸러 즉시 알려줍니다.
    const oversized = Array.from(files).filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    const valid = Array.from(files).filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    if (oversized.length) {
      setSaveError(
        `${oversized.map((f) => f.name).join(", ")} — 파일당 최대 20MB까지 첨부할 수 있습니다.`,
      );
    }
    if (!valid.length) return;
    const no = savedNo ?? genNo();
    setSavedNo(no);
    setUploading(true);
    try {
      for (const file of valid) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let url = "";
        if (isFirebaseConfigured) {
          const snap = await uploadBytes(
            storageRef(
              firebaseStorage(),
              `approvals/${no}/${Date.now()}-${file.name}`,
            ),
            file,
            { contentType: file.type || "application/octet-stream" },
          );
          url = await getDownloadURL(snap.ref);
        }
        setAttachments((p) => [
          ...p,
          { id, name: file.name, size: fmtSize(file.size), url, kind: extKind(file.name) },
        ]);
        if (getGoogleDriveSession()) {
          uploadFileToDrive(file).then((saved) => {
            if (!saved) return;
            setAttachments((p) =>
              p.map((a) => (a.id === id ? { ...a, drive: true } : a)),
            );
          });
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const persist = async (mode: "draft" | "submit") => {
    if (!canSave) return;
    setSaveError(null);
    if (mode === "submit" && approvers.length === 0) {
      setSaveError("결재자를 1명 이상 지정해주세요.");
      return;
    }
    if (mode === "submit" && leaveOverBalance) {
      setSaveError("잔여 연차가 부족합니다. 휴가 기간을 조정해주세요.");
      return;
    }
    setSaving(mode);
    try {
      const no = savedNo ?? genNo();
      await createApproval({
        no,
        type: docType,
        title: title.trim(),
        approver: approvers[approvers.length - 1]?.label ?? "미지정",
        status: "Waiting",
        bucket: mode === "submit" ? "pending" : "drafted",
        line: buildLine(),
        meta: buildMeta(),
        rows: buildRows(),
        attachments,
        reason: buildReason() || undefined,
        leaveRequest:
          form === "휴가신청서"
            ? {
                kind: leaveKind,
                start: leaveStart,
                end: leaveEnd,
                days: leaveKind === "반차" ? 0.5 : leaveDays,
              }
            : undefined,
        // 제출(submit) 시에도 남겨둡니다 — 이후 승인 전 문서를 다시 임시저장
        // 상태로 되돌리는 기능이 생기더라도 원본 입력을 잃지 않도록.
        draftState: buildDraftState(),
      });
      setSavedNo(no);
      if (mode === "submit") {
        router.push(`/approval/${encodeURIComponent(no)}`);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3.5 rounded-[13px] border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
        <Link
          href="/approval"
          className="flex h-8.5 items-center gap-1.5 rounded-[9px] border border-border bg-card pl-2.5 pr-2.5 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
        >
          <ArrowLeft className="size-3.5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold tracking-[-0.02em]">
            {form}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {FORM_TEMPLATES.find((f) => f.name === form)?.desc}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {savedNo && (
            <span className="hidden text-[11.5px] text-muted-foreground sm:inline">
              저장됨 · {savedNo}
            </span>
          )}
          <button
            onClick={() => persist("draft")}
            disabled={!canSave}
            className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-3.5" />
            {saving === "draft" ? "저장 중…" : "임시저장"}
          </button>
          <button
            onClick={() => persist("submit")}
            disabled={!canSave}
            className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(79,70,229,0.35)] hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="size-3.5" />
            {saving === "submit" ? "상신 중…" : "결재 요청하기"}
          </button>
        </div>
      </div>

      {saveError && (
        <p className="rounded-[10px] border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#b91c1c]">
          {saveError}
        </p>
      )}
      {loadError && (
        <p className="rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#92400e]">
          {loadError}
        </p>
      )}

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
            {buildMeta().map((m) => (
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
            <span className="ml-auto text-[11px] text-muted-foreground">
              기안 →{" "}
              {approvers.length
                ? `결재 ${approvers.length}단계`
                : "결재자 미지정"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-[9px] border border-[#e0e7ff] bg-[#f5f6ff] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#4338ca]">
              <span style={pill("#e0e7ff", "#4338ca")}>기안</span>
              {me.name || "나"}
            </span>
            {approvers.map((a, i) => (
              <span
                key={a.uid}
                className="flex items-center gap-1.5 rounded-[9px] border border-border bg-card px-2.5 py-1.5 text-[11.5px] font-medium text-secondary-foreground"
              >
                <span style={pill("#eef2ff", "#4338ca")}>결재 {i + 1}</span>
                {a.label}
                <button
                  type="button"
                  onClick={() =>
                    setApprovers((p) => p.filter((x) => x.uid !== a.uid))
                  }
                  className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="relative mt-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={approverQuery}
                onChange={(e) => {
                  setApproverQuery(e.target.value);
                  setApproverOpen(true);
                }}
                onFocus={() => setApproverOpen(true)}
                onBlur={() => setTimeout(() => setApproverOpen(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (approverMatches[0]) addApprover(approverMatches[0]);
                  }
                }}
                placeholder="구성원 이름·직급·부서로 검색"
                className={cn(inputCls, "h-8.5 pl-8")}
              />
            </div>
            {approverOpen && approverQ && (
              <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-[10px] border border-border bg-card shadow-[var(--shadow-pop)]">
                {approverMatches.length === 0 ? (
                  <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">
                    일치하는 구성원이 없습니다
                  </div>
                ) : (
                  approverMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addApprover(p)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] hover:bg-secondary"
                    >
                      <span style={avatarStyle(p.name.charAt(0), 26)}>
                        {p.name.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {p.name} {p.role}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {p.dept}
                        </span>
                      </span>
                      <Plus className="size-3.5 shrink-0 text-primary" strokeWidth={2.2} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </GwCard>
      </div>

      <GwCard className="shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
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
                        date: todayDot(),
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
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => {
                      setLeaveStart(e.target.value);
                      if (e.target.value > leaveEnd) setLeaveEnd(e.target.value);
                    }}
                    className={inputCls}
                  />
                </div>
                <div className="flex-[1_1_180px]">
                  <div className={labelCls}>종료일</div>
                  <input
                    type="date"
                    value={leaveEnd}
                    min={leaveStart}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex-[1_1_160px]">
                  <div className={labelCls}>신청 일수 / 잔여</div>
                  <div
                    className={cn(
                      "flex h-9.5 items-baseline gap-1.5 rounded-[9px] border px-3",
                      leaveOverBalance
                        ? "border-[#fecaca] bg-[#fef2f2]"
                        : "border-[#e0e7ff] bg-[#f5f6ff]",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[15px] font-semibold tabular-nums",
                        leaveOverBalance ? "text-[#b91c1c]" : "text-[#3730a3]",
                      )}
                    >
                      {leaveKind === "반차" ? 0.5 : leaveDays}일
                    </span>
                    <span
                      className={cn(
                        "text-[11.5px]",
                        leaveOverBalance ? "text-[#b91c1c]" : "text-[#6366f1]",
                      )}
                    >
                      잔여 {leaveBalance.remaining}일
                    </span>
                    {leaveOverBalance && (
                      <span className="ml-auto text-[11.5px] font-semibold text-[#b91c1c]">
                        잔여 연차 부족
                      </span>
                    )}
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
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                uploadAttachments(e.dataTransfer.files);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#cbd5e1] bg-secondary p-6 transition-colors hover:border-ring hover:bg-[#f5f6ff]"
            >
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  uploadAttachments(e.target.files);
                  e.target.value = "";
                }}
              />
              <Upload className="size-4 text-secondary-foreground" />
              <span className="text-[12.5px] font-semibold text-secondary-foreground">
                {uploading
                  ? "업로드 중…"
                  : "파일을 여기로 끌어다 놓거나 클릭해 업로드"}
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                PDF, JPG, XLSX · 파일당 최대 20MB
              </span>
            </label>
            {attachments.map((f, i) => (
              <div
                key={f.id}
                className="flex items-center gap-2.5 rounded-[10px] border border-border px-3 py-2.5 text-[12.5px]"
              >
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{f.name}</span>
                {f.drive && (
                  <span
                    title="Google Drive에도 보관됨"
                    className="flex items-center gap-1 rounded-full bg-[#f0fdf4] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#15803d]"
                  >
                    <HardDrive className="size-2.5" />
                    Drive
                  </span>
                )}
                <span className="tabular-nums text-[11.5px] text-muted-foreground">
                  {f.size}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((p) => p.filter((_, x) => x !== i))
                  }
                  className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </GwCard>
    </div>
  );
}
