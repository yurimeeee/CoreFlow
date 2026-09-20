/**
 * CoreFlow 그룹웨어 — Firestore 컬렉션 정의 · 시드 페이로드
 *
 * 컬렉션
 *   teams/{id}          부서/팀 편제 (parentId 로 본부-팀 계층 구성)
 *   notices/{id}        공지사항
 *   tasks/{id}          프로젝트 Task (칸반 카드, colKey 로 컬럼 구분)
 *   approvals/{no}      전자결재 문서 (id = 문서번호)
 *   bookings/{id}       회의실 · 자원 예약
 *   attendance/{uid}    사용자별 출퇴근 상태 (본인만 읽기/쓰기)
 *   users/{uid}         로그인 사용자 프로필 + gwSettings — 조직도(임직원 디렉토리)의 단일 소스.
 *                        가계정(아직 미입사)은 users/{placeholder-<random>} 로 존재(status: "PLACEHOLDER")
 *   workspace/main      회사(워크스페이스) 기본 정보 — 관리자만 쓰기
 */
import {
  SEED_APPROVAL_DETAIL,
  SEED_APPROVAL_ROWS,
  SEED_BOARD,
  SEED_BOOKING_DATE,
  SEED_BOOKINGS,
  SEED_NOTICE_ALL,
  SEED_NOTICE_PINNED,
  SEED_WORKSPACE,
} from "./seed-data";

export const COL = {
  teams: "teams",
  notices: "notices",
  tasks: "tasks",
  approvals: "approvals",
  bookings: "bookings",
  attendance: "attendance",
  leaves: "leaves",
  events: "events",
  sessions: "sessions",
  users: "users",
  workspace: "workspace",
} as const;

/** notices/{id}/comments 서브컬렉션 경로 */
export const noticeCommentsPath = (noticeId: string) =>
  `${COL.notices}/${noticeId}/comments`;

export const TASK_COLUMNS: { key: string; name: string; color: string }[] = [
  { key: "todo", name: "To Do", color: "#94a3b8" },
  { key: "doing", name: "In Progress", color: "#4f46e5" },
  { key: "review", name: "Review", color: "#f59e0b" },
  { key: "done", name: "Done", color: "#16a34a" },
];

/* ------------------------------------------------------------------ */
/*  Firestore 문서 타입                                                 */
/* ------------------------------------------------------------------ */

export interface TaskDoc {
  id: string;
  colKey: string;
  tag: string;
  title: string;
  who: string;
  dday: string;
  done: number;
  total: number;
  order: number;
  /** 상세 내용 (선택) */
  desc?: string;
  /** 시작일 yyyy-mm-dd (선택) */
  startDate?: string;
  /** 마감일 yyyy-mm-dd (선택) — dday 자동 계산에 사용 */
  dueDate?: string;
  /** 마감 시각 HH:MM (선택) */
  time?: string;
  /** 담당자 uid — 실존 인물을 선택했을 때만 채워짐(자유 입력 시 null) */
  assigneeId?: string | null;
  /** 담당자 선택 시점의 소속 팀 id 스냅샷 — 팀 필터에 사용 */
  teamId?: string | null;
}

/** Task 뱃지/카테고리로 고를 수 있는 프리셋 (자유 입력도 허용) */
export const TASK_TAGS = [
  "기획",
  "개발",
  "HR",
  "보고",
  "필수",
  "UI/UX",
  "Backend",
  "Frontend",
  "QA",
] as const;

export interface NoticeDoc {
  id: string;
  cat: string;
  title: string;
  author: string;
  date: string;
  views: number;
  attach: boolean;
  unread: boolean;
  pinned: boolean;
  body?: string;
  order: number;
  /** 댓글 수 (notices/{id}/comments 서브컬렉션과 동기, increment 로 관리) */
  comments?: number;
  /* 필독 카드 스타일 (pinned 전용) */
  icon?: string;
  accent?: string;
  titleColor?: string;
  bg?: string;
  border?: string;
  chip?: [string, string];
}

export interface ApprovalDoc {
  no: string;
  type: string;
  title: string;
  author: string;
  /** 기안자 uid — 결재 권한 검증(본인 문서 여부 판단)에 사용 */
  authorUid?: string;
  date: string;
  approver: string;
  status: string; // Waiting | In Progress | Approved | Rejected
  bucket: "pending" | "drafted" | "referenced";
  order: number;
  /**
   * 현재 결재 차례인 사람의 uid. line 의 다음 미완료 결재 단계와 동기화되며,
   * 승인/반려는 이 uid 를 가진 사용자만 수행할 수 있습니다(완결/반려 시 null).
   * Firestore 보안 규칙이 이 필드로 승인/반려 요청자를 검증합니다.
   */
  currentApproverUid?: string | null;
  /**
   * 휴가신청서(type "휴가")의 구조화된 신청 내역 — 승인 완료 시 이 값을
   * 근거로 leaves/{no} 문서를 생성해 실제 연차 잔여에 반영합니다.
   */
  leaveRequest?: { kind: string; start: string; end: string; days: number };
  /* 상세(선택) */
  line?: { kind: string; name: string; role: string; state: string; at: string; done: boolean; uid?: string }[];
  meta?: { label: string; value: string }[];
  rows?: { date: string; desc: string; amount: number; receipt: string }[];
  comments?: { name: string; role: string; at: string; body: string }[];
  attachments?: { name: string; size: string; url: string; kind: string }[];
  reason?: string;
}

export interface BookingDoc {
  id: string;
  res: string; // 자원 key (RESOURCES[].key)
  from: number; // 시작 슬롯 (0..BOOKING_SLOTS)
  to: number; // 종료 슬롯 (exclusive)
  title: string;
  who: string; // 예약자 이름
  date: string; // yyyy-mm-dd
  purpose?: string;
  attendees?: string[]; // 참석자 uid 목록 (users/{uid})
  video?: boolean;
  provider?: string; // Google Meet | Zoom
  order: number; // 정렬용 = from
}

/** 부서/팀 편제 — parentId 로 본부(최상위) - 팀 2단 계층을 구성 */
export interface TeamDoc {
  id: string;
  name: string;
  parentId: string | null; // null = 본부(최상위)
  order: number;
}

export interface AttendanceDoc {
  uid: string;
  working: boolean;
  inAt: string;
  outAt: string;
  date: string; // yyyy-mm-dd (마지막 기록일)
  weekWorked: number;
  history: { day: string; in: string; out: string; hours: string; pct: number; type: string; color: string }[];
}

export interface LeaveDoc {
  id: string;
  uid: string;
  who: string;
  kind: string; // 연차 | 반차 | 경조 | 병가 | 초과근무
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
  days: number; // 소요 일수 (초과근무는 0)
  hours: number; // 초과근무 시간 (그 외 0)
  reason: string;
  status: "대기" | "승인" | "반려";
  order: number;
}

/** 연차 부여 기본값 (전용 정책 컬렉션 없음 · 데모 기준) */
export const ANNUAL_LEAVE_TOTAL = 15;

export interface NoticeCommentDoc {
  id: string;
  uid: string;
  author: string;
  role: string;
  body: string;
  at: string; // yyyy.mm.dd HH:MM
  order: number;
}

/** 캘린더 일정 — events/{id} (owner 본인만 수정/삭제) */
export interface EventDoc {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd (시작일)
  end?: string; // yyyy-mm-dd (종료일, 없으면 date 와 동일 = 하루 일정)
  start: string; // HH:MM ("" = 종일)
  finish: string; // HH:MM ("" = 종일)
  allDay: boolean;
  category: string; // 회의 | 미팅 | 개인 | 마감 | 기타
  location: string;
  memo: string;
  owner: string; // uid
  ownerName: string;
  color: string;
  order: number;
  /** 작성자(owner)의 작성 시점 소속 팀 id 스냅샷 — 팀 필터에 사용 */
  teamId?: string | null;
}

export const EVENT_CATEGORIES: { key: string; color: string }[] = [
  { key: "회의", color: "#4f46e5" },
  { key: "미팅", color: "#0ea5e9" },
  { key: "개인", color: "#16a34a" },
  { key: "마감", color: "#f59e0b" },
  { key: "기타", color: "#64748b" },
];

/**
 * 실제 접속 기기(브라우저) 세션 — sessions/{sessionId}.
 * sessionId 는 (계정, 브라우저) 조합마다 localStorage 에 영구 발급되어
 * 같은 브라우저로 재접속하면 같은 문서를 이어서 갱신합니다.
 * 서버(Admin SDK)가 없어 다른 기기의 Firebase Auth 세션 자체를 강제로
 * 만료시킬 수는 없지만, 그 기기가 앱을 열어둔 상태라면 이 문서 삭제를
 * 실시간으로 감지해 스스로 로그아웃합니다.
 */
export interface SessionDoc {
  id: string;
  uid: string;
  device: string; // 예: "Mac · Chrome"
  icon: string; // SESSION_ICONS 키
  userAgent: string;
  createdAt: number; // epoch ms
  lastActive: number; // epoch ms
}

/** Slack/Jandi 등 Incoming Webhook 기반 연동의 공통 설정 */
export interface WorkspaceWebhookIntegration {
  on: boolean;
  webhookUrl?: string;
}

export interface WorkspaceDoc {
  name: string;
  bizNo: string;
  ceo: string;
  address: string;
  phone: string;
  fiscalYearStart: string;
  /** 역할 기반 접근 제어 오버라이드 — { 기능키: [SuperAdmin, Admin, Manager, Member] } (0/1/2) */
  rbac?: Record<string, number[]>;
  /** 워크스페이스(전사) 단위 외부 서비스 연동 — 관리자만 설정 가능 */
  integrations?: {
    slack?: WorkspaceWebhookIntegration;
    jandi?: WorkspaceWebhookIntegration;
  };
}

/** 텍스트로 편집 가능한 워크스페이스 필드 (rbac·integrations 등 구조 필드 제외) */
export type WorkspaceTextField = Exclude<
  keyof WorkspaceDoc,
  "rbac" | "integrations"
>;

export const WORKSPACE_FIELD_LABELS: { key: WorkspaceTextField; label: string; placeholder: string }[] = [
  { key: "name", label: "회사명", placeholder: "주식회사 ○○" },
  { key: "bizNo", label: "사업자등록번호", placeholder: "000-00-00000" },
  { key: "ceo", label: "대표이사", placeholder: "홍길동" },
  { key: "address", label: "본사 주소", placeholder: "서울 강남구 ..." },
  { key: "phone", label: "대표 전화", placeholder: "02-000-0000" },
  { key: "fiscalYearStart", label: "회계연도 시작", placeholder: "매년 1월 1일" },
];

/* ------------------------------------------------------------------ */
/*  시드 페이로드                                                       */
/* ------------------------------------------------------------------ */

export interface SeedDoc {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}

export function buildSeed(): SeedDoc[] {
  const out: SeedDoc[] = [];

  /* 공지 — 필독 고정 (pinned-*) + 일반 (n-*) */
  SEED_NOTICE_PINNED.forEach((p, i) => {
    out.push({
      collection: COL.notices,
      id: `pinned-${i}`,
      data: {
        cat: p.tag,
        title: p.title,
        author: p.author,
        date: p.date.slice(5),
        views: Number(p.views),
        attach: true,
        unread: true,
        pinned: true,
        body: p.body,
        order: i,
        icon: p.icon,
        accent: p.accent,
        titleColor: p.titleColor,
        bg: p.bg,
        border: p.border,
        chip: p.chip,
      } satisfies Omit<NoticeDoc, "id">,
    });
  });
  SEED_NOTICE_ALL.forEach((n, i) => {
    out.push({
      collection: COL.notices,
      id: `n-${i}`,
      data: { ...n, pinned: false, order: 10 + i } satisfies Omit<NoticeDoc, "id">,
    });
  });

  /* 프로젝트 Task — 칸반 컬럼을 flat 하게 tasks/{id} */
  SEED_BOARD.forEach((col, c) => {
    col.items.forEach((t, i) => {
      out.push({
        collection: COL.tasks,
        id: String(t.id),
        data: {
          colKey: col.key,
          tag: t.tag,
          title: t.title,
          who: t.who,
          dday: t.dday,
          done: t.done,
          total: t.total,
          order: c * 100 + i,
        } satisfies Omit<TaskDoc, "id">,
      });
    });
  });

  /* 전자결재 — 3개 버킷 approvals/{no} */
  const buckets: ApprovalDoc["bucket"][] = ["pending", "drafted", "referenced"];
  SEED_APPROVAL_ROWS.forEach((rows, b) => {
    rows.forEach((r, i) => {
      const detail = SEED_APPROVAL_DETAIL[r.no];
      const extra: Partial<ApprovalDoc> = detail
        ? {
            line: detail.line,
            meta: detail.meta,
            rows: detail.rows,
            comments: detail.comments,
            reason: detail.reason,
          }
        : {
            line: [
              { kind: "기안", name: r.author.split(" ")[0], role: "기안자", state: "기안", at: r.date, done: true },
              {
                kind: "결재",
                name: r.approver.split(" ")[0],
                role: "결재자",
                state: r.status === "Approved" ? "승인" : r.status === "Rejected" ? "반려" : "대기",
                at: "",
                done: r.status === "Approved",
              },
            ],
            meta: [
              { label: "문서번호", value: r.no },
              { label: "기안자", value: r.author },
              { label: "기안일자", value: `2026.${r.date}` },
            ],
          };
      out.push({
        collection: COL.approvals,
        id: r.no,
        data: {
          no: r.no,
          type: r.type,
          title: r.title,
          author: r.author,
          date: r.date,
          approver: r.approver,
          status: r.status,
          bucket: buckets[b],
          order: i,
          ...extra,
        },
      });
    });
  });

  /* 회의실 · 자원 예약 — bookings/{id} */
  SEED_BOOKINGS.forEach((bk) => {
    out.push({
      collection: COL.bookings,
      id: bk.id,
      data: {
        res: bk.res,
        from: bk.from,
        to: bk.to,
        title: bk.title,
        who: bk.who,
        date: SEED_BOOKING_DATE,
        purpose: bk.purpose,
        video: bk.video,
        provider: bk.provider,
        order: bk.from,
      } satisfies Omit<BookingDoc, "id">,
    });
  });

  /* 워크스페이스(회사) 기본 정보 — workspace/main */
  out.push({
    collection: COL.workspace,
    id: "main",
    data: { ...SEED_WORKSPACE } satisfies WorkspaceDoc,
  });

  return out;
}
