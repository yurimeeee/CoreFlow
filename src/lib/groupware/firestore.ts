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
  chats: "chats",
} as const;

/** notices/{id}/comments 서브컬렉션 경로 */
export const noticeCommentsPath = (noticeId: string) =>
  `${COL.notices}/${noticeId}/comments`;

/** tasks/{id}/comments 서브컬렉션 경로 */
export const taskCommentsPath = (taskId: string) =>
  `${COL.tasks}/${taskId}/comments`;

/** approvals/{no}/comments 서브컬렉션 경로 */
export const approvalCommentsPath = (no: string) =>
  `${COL.approvals}/${no}/comments`;

/** chats/{id}/messages 서브컬렉션 경로 */
export const chatMessagesPath = (chatId: string) =>
  `${COL.chats}/${chatId}/messages`;

/** 1:1 대화방 id — 두 uid를 정렬해 합치므로 항상 같은 두 사람이 같은 방을 씁니다. */
export const dmChatId = (uidA: string, uidB: string) =>
  [uidA, uidB].sort().join("_");

/**
 * 채팅 첨부파일 용량 제한 — storage.rules의 `chats/{chatId}/*` 쓰기 규칙
 * (`request.resource.size < 20 * 1024 * 1024`)과 반드시 같은 값이어야
 * 합니다. 클라이언트에서 미리 걸러 업로드 자체를 시도하지 않게 합니다.
 */
export const CHAT_FILE_MAX_MB = 20;
export const CHAT_FILE_MAX_BYTES = CHAT_FILE_MAX_MB * 1024 * 1024;

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
  /** 작성자 uid — 임시저장함 필터·수정 권한 판단에 사용 */
  authorUid?: string;
  date: string;
  views: number;
  attach: boolean;
  pinned: boolean;
  body?: string;
  order: number;
  /** "draft"면 임시저장(작성자 본인에게만 노출) — 값이 없으면 게시된 것으로 취급(레거시) */
  status?: "draft" | "published";
  /** 댓글 수 (notices/{id}/comments 서브컬렉션과 동기, increment 로 관리) */
  comments?: number;
  /**
   * 이 공지를 열어본 적 있는 uid 목록 — "안 읽음"은 uid 하나당 값이 아니라
   * 문서당 boolean 필드 하나(구 unread)였을 때, 누구 한 명만 열어봐도 그
   * 즉시 회사 전체에게 "읽음"으로 바뀌는 문제가 있어 사용자별로 바꿨습니다.
   * isNoticeUnread()로 "나에게" 안 읽은 상태인지 판정합니다.
   */
  readByUids?: string[];
  /* 필독 카드 스타일 (pinned 전용) */
  icon?: string;
  accent?: string;
  titleColor?: string;
  bg?: string;
  border?: string;
  chip?: [string, string];
}

/** 로그인한 사용자 기준 이 공지가 "안 읽음"인지 — readByUids에 내 uid가
 *  없으면 안 읽은 것으로 봅니다. uid가 없는(로그인 전/데모) 경우는 항상
 *  안 읽음으로 취급합니다. */
export function isNoticeUnread(
  n: Pick<NoticeDoc, "readByUids">,
  uid: string | null,
): boolean {
  if (!uid) return true;
  return !(n.readByUids ?? []).includes(uid);
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
   * line 에 속한 모든 결재 단계(기안 포함)의 uid 를 평탄화한 목록 — 생성
   * 시점 한 번만 계산해 저장합니다(이후 승인/반려로 각 단계의 state/done/
   * at 만 바뀔 뿐 결재선 구성원 자체는 바뀌지 않음). firestore.rules ·
   * storage.rules 가 "결재 문서 열람은 기안자/결재라인/관리자만" 을
   * 판정할 때 이 필드를 씁니다 — line 은 객체 배열이라 보안 규칙에서 직접
   * 필터링할 수 없어 uid 만 뽑아 별도로 둡니다. 이 필드가 추가되기 전에
   * 생성된 문서는 값이 없으므로 authorUid/currentApproverUid 로만 판정됩니다.
   */
  approverUids?: string[];
  /**
   * 휴가신청서(type "휴가")의 구조화된 신청 내역 — 승인 완료 시 이 값을
   * 근거로 leaves/{no} 문서를 생성해 실제 연차 잔여에 반영합니다.
   */
  leaveRequest?: { kind: string; start: string; end: string; days: number };
  /* 상세(선택) */
  line?: { kind: string; name: string; role: string; state: string; at: string; done: boolean; uid?: string }[];
  meta?: { label: string; value: string }[];
  rows?: { date: string; desc: string; amount: number; receipt: string }[];
  attachments?: { name: string; size: string; url: string; kind: string }[];
  reason?: string;
  /**
   * 임시저장(bucket "drafted") 화면(/approval/new)의 입력 필드 스냅샷 —
   * "이어서 작성"으로 돌아왔을 때 meta/reason 텍스트를 역파싱하지 않고
   * 원래 폼 상태 그대로 복원하기 위해 저장합니다.
   */
  draftState?: Record<string, unknown>;
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
  /**
   * 예약자가 직접 붙여넣은 화상회의 참여 링크(선택) — CoreFlow가 Zoom/Meet
   * API로 링크를 만들거나 발송해주지는 않으므로, 실제 공유 가능한 값은
   * 이것뿐입니다. 비어 있으면 상세 화면에 "링크는 별도 공유" 안내만 뜹니다.
   */
  meetingUrl?: string;
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

/** 연차 잔여 계산에 실제로 차감되는 휴가 종류 (초과근무 · 경조 · 병가는 제외) */
export const LEAVE_TYPES_COUNTED = ["연차", "반차"];

/**
 * 연차 잔여 계산 — 반려되지 않은 연차/반차 신청의 days 합을 총 부여일수에서
 * 차감합니다. useLeaves() 가 구독한 leaves 데이터에 그대로 적용됩니다.
 */
export function calculateLeaveBalance(
  leaves: Pick<LeaveDoc, "kind" | "status" | "days">[],
  total: number = ANNUAL_LEAVE_TOTAL,
): { total: number; used: number; remaining: number } {
  const used = leaves
    .filter((l) => LEAVE_TYPES_COUNTED.includes(l.kind) && l.status !== "반려")
    .reduce((sum, l) => sum + (l.days || 0), 0);
  return { total, used, remaining: Math.max(0, total - used) };
}

export interface NoticeCommentDoc {
  id: string;
  uid: string;
  author: string;
  role: string;
  body: string;
  at: string; // yyyy.mm.dd HH:MM
  order: number;
  /** 수정된 댓글인지 (UI에 "(수정됨)" 표시용) */
  edited?: boolean;
}

/** Task 댓글 — tasks/{id}/comments 서브컬렉션. NoticeCommentDoc과 필드는 같지만
 *  Task 카드에는 댓글 수를 별도로 집계하지 않음(칸반 카드마다 실시간 구독을
 *  거는 것을 피하기 위함) — 댓글은 Task 상세 모달을 열었을 때만 구독합니다. */
export interface TaskCommentDoc {
  id: string;
  uid: string;
  author: string;
  role: string;
  body: string;
  at: string; // yyyy.mm.dd HH:MM
  order: number;
  edited?: boolean;
}

/** 결재 의견 — approvals/{no}/comments 서브컬렉션. NoticeCommentDoc/TaskCommentDoc과
 *  동일한 형태 — 예전엔 approvals 문서의 comments 배열 필드였으나, 배열 원소
 *  단위로는 작성자만 수정/삭제하도록 보안 규칙을 걸 수 없어(결재선에 있는
 *  아무나 남의 의견을 고치거나 지울 수 있었음) 서브컬렉션으로 분리. */
export interface ApprovalCommentDoc {
  id: string;
  uid: string;
  author: string;
  role: string;
  body: string;
  at: string; // yyyy.mm.dd HH:MM
  order: number;
  edited?: boolean;
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

/**
 * 사내 메신저 — chats/{id}. 1:1(dm)은 id가 두 uid를 정렬해 합친 값(dmChatId)
 * 이라 같은 두 사람이 다시 "메시지"를 눌러도 항상 같은 방으로 이어집니다.
 * 그룹은 id를 자동 생성. readAt은 멤버별 "마지막으로 읽은 시각"만 들고 있어
 * (메시지마다 읽음 상태를 쓰지 않음) 안 읽은 메시지 수는
 * lastMessageAt > readAt[uid] 비교로 계산합니다.
 */
export interface ChatDoc {
  id: string;
  type: "dm" | "group";
  memberIds: string[];
  /** uid → 이름 스냅샷(생성 시점) — 목록 렌더링에 매 멤버 조회를 안 하려고 저장 */
  memberNames: Record<string, string>;
  /** 그룹만 사용(직접 입력 또는 멤버 이름 자동 조합). dm은 상대 이름을 그때그때 표시 */
  name?: string;
  lastMessage: string;
  lastMessageAt: number; // epoch ms, 아직 메시지 없으면 0
  lastMessageSenderId: string | null;
  /** uid → 마지막으로 읽은 시각(epoch ms) */
  readAt: Record<string, number>;
  createdAt: number;
  createdBy: string;
}

export interface ChatMessageDoc {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  type: "text" | "image" | "file";
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  createdAt: number; // epoch ms
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
            // 시드 의견(SEED_APPROVAL_DETAIL.comments)은 이제 comments
            // 서브컬렉션 몫이라 여기서는 approvals 문서 자체에 심지 않습니다
            // — notices/tasks 시드도 댓글 서브컬렉션은 채우지 않는 것과 동일.
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
