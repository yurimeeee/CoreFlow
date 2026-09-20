/**
 * CoreFlow 그룹웨어 — 정적 타입 · 색상 설정 · 필터 옵션
 *
 * 인물/문서/일정 "레코드"는 Firestore 컬렉션이 단일 소스이고, 비어 있으면
 * 각 화면은 빈 상태(empty state)를 그립니다.
 * 아래 값들은 "데이터"가 아니라 화면이 동작하는 데 필요한 구조(타입), 색상
 * 매핑, 필터·탭 옵션 라벨입니다. 조직 편제(부서 트리·본부/팀 branches)는
 * `org-tree.ts`가 실제 `orgPeople` 목록에서 계산합니다.
 */

export type PersonStatus = "online" | "remote" | "away" | "leave";

export interface Person {
  id: number;
  name: string;
  role: string;
  dept: string;
  team: string;
  email: string;
  ext: string;
  mobile: string;
  status: PersonStatus;
  boss: number | null;
  tags: string[];
}

export const STATUS_META: Record<
  PersonStatus,
  { label: string; color: string; pillBg: string; pillFg: string }
> = {
  online: { label: "근무 중", color: "#16a34a", pillBg: "#f0fdf4", pillFg: "#15803d" },
  remote: { label: "원격근무", color: "#4f46e5", pillBg: "#eef2ff", pillFg: "#4338ca" },
  away: { label: "회의 중", color: "#f59e0b", pillBg: "#fff7ed", pillFg: "#c2410c" },
  leave: { label: "연차", color: "#94a3b8", pillBg: "#f1f5f9", pillFg: "#475569" },
};

/** 조직도 인물 목록 — Firestore `orgPeople` 컬렉션이 실제 데이터 소스입니다. */
export const PEOPLE: Person[] = [];

export const personById = (id: number) => PEOPLE.find((p) => p.id === id);

/* ---------------- 대시보드 ---------------- */

export const DASH_NOTICES: { title: string; dept: string; date: string; must: boolean }[] = [];
export const DASH_TASKS: {
  id: number; title: string; tag: string; due: string; dday: string; done: boolean;
}[] = [];
export const DASH_APPROVALS: { type: string; title: string; state: string }[] = [];

/* ---------------- 근태 ---------------- */

export const ATT_DAY_DATA: Record<number, [string, string, string]> = {};

export const ATT_TYPE_COLORS: Record<string, [string, string, string]> = {
  정상: ["#eef2ff", "#4338ca", "#4f46e5"],
  지각: ["#fff7ed", "#c2410c", "#f59e0b"],
  연차: ["#f1f5f9", "#475569", "#94a3b8"],
  연장: ["#fef2f2", "#b91c1c", "#e11d48"],
  재택: ["#f0fdf4", "#15803d", "#16a34a"],
};

export const ATT_ROWS: {
  day: string; in: string; out: string; hours: string; pct: number; type: string; color: string;
}[] = [];

export const LEAVE_HISTORY: { type: string; date: string; days: string }[] = [];

/** 주 52시간 트래커 임계선 */
export const WEEK_WARN = 45; // 경고(앰버) 진입
export const WEEK_LIMIT = 52; // 법정 한도(레드)

/** 월 캘린더 셀에 표시할 팀원 부재(OOO) — 일자 → [이름, 종류][] */
export const ATT_OOO: Record<number, [string, string][]> = {};

export const OOO_COLORS: Record<string, string> = {
  연차: "#94a3b8",
  반차: "#a78bfa",
  재택: "#16a34a",
  경조: "#f59e0b",
};

/* ---------------- 전자결재 ---------------- */

export const APPROVAL_STATS: {
  label: string; value: number; color: string; bg: string; icon: string;
}[] = [
  { label: "결재 대기", value: 0, color: "#4f46e5", bg: "#eef2ff", icon: "Inbox" },
  { label: "진행 중", value: 0, color: "#0f172a", bg: "#f1f5f9", icon: "Loader" },
  { label: "완료", value: 0, color: "#0f172a", bg: "#f0fdf4", icon: "CircleCheck" },
  { label: "반려", value: 0, color: "#94a3b8", bg: "#fef2f2", icon: "CircleX" },
];

export const APPROVAL_TABS = ["대기 문서", "기안 문서", "참조 문서"];

export type ApprovalRow = {
  no: string; type: string; title: string; author: string; date: string; approver: string; status: string;
};

export const APPROVAL_ROWS: ApprovalRow[][] = [[], [], []];

export const APPROVAL_TYPE_COLORS: Record<string, [string, string]> = {
  휴가: ["#eef2ff", "#4338ca"], 지출: ["#f0fdf4", "#15803d"], 품의: ["#fff7ed", "#c2410c"],
  보고: ["#f1f5f9", "#475569"], 인사: ["#f5f3ff", "#6d28d9"],
};

export const APPROVAL_STATUS_COLORS: Record<string, [string, string]> = {
  Waiting: ["#fff7ed", "#c2410c"], "In Progress": ["#eef2ff", "#4338ca"],
  Approved: ["#f0fdf4", "#15803d"], Rejected: ["#fef2f2", "#b91c1c"],
};

/* 결재 문서 상세 — 실제 데이터는 Firestore `approvals/{no}` 문서에서 읽습니다. */
export const DETAIL_LINE: {
  kind: string; name: string; role: string; state: string; at: string; done: boolean;
}[] = [];

export const DETAIL_META: { label: string; value: string }[] = [];

export const DETAIL_ROWS: { date: string; desc: string; amount: number; receipt: string }[] = [];

export const DETAIL_COMMENTS: { name: string; role: string; at: string; body: string }[] = [];

export const DETAIL_ATTACHMENTS: { name: string; size: string; kind: string }[] = [];

/* 기안 양식 — 사내에서 실제로 쓸 문서 양식 종류(구조), 개별 문서 데이터는 아님 */
export const FORM_TEMPLATES: { name: string; desc: string; icon: string }[] = [
  { name: "지출결의서", desc: "경비 집행 및 정산 · 재무팀 경유", icon: "Receipt" },
  { name: "휴가신청서", desc: "연차 / 반차 / 경조 휴가 신청", icon: "Palmtree" },
  { name: "품의서", desc: "구매 · 계약 · 도입 사전 승인", icon: "FileSignature" },
  { name: "업무보고서", desc: "주간 / 월간 업무 실적 보고", icon: "FileBarChart" },
  { name: "근무시간 변경 신청", desc: "유연근무 시간대 변경 요청", icon: "Clock4" },
  { name: "구매요청서", desc: "비품 · 장비 · 소프트웨어 구매", icon: "ShoppingCart" },
];

export const DRAFT_APPROVAL_LINE: {
  kind: string; name: string; role: string; state: string; mark: string;
}[] = [];

export const DRAFT_META: { label: string; value: string }[] = [];

export const EXPENSE_ROWS: { id: number; date: string; desc: string; amount: string; receipt: string }[] = [];

export const PURCHASE_ROWS: { id: number; name: string; spec: string; qty: string; price: string }[] = [];

/* ---------------- 프로젝트 / Task ---------------- */

export const TAG_COLORS: Record<string, [string, string]> = {
  기획: ["#eef2ff", "#4338ca"], 개발: ["#eff6ff", "#1d4ed8"], HR: ["#f5f3ff", "#6d28d9"],
  보고: ["#f1f5f9", "#475569"], 필수: ["#fef2f2", "#b91c1c"],
  "UI/UX": ["#f5f3ff", "#6d28d9"], Backend: ["#eff6ff", "#1d4ed8"],
  Frontend: ["#ecfeff", "#0e7490"], QA: ["#fff7ed", "#c2410c"],
};

export interface BoardCol {
  key: string;
  name: string;
  color: string;
  items: {
    id: number; tag: string; title: string; who: string; dday: string; done: number; total: number;
  }[];
}

/** 칸반 컬럼 구조만 유지 — 카드(items)는 Firestore `tasks` 컬렉션에서 채웁니다. */
export const BOARD: BoardCol[] = [
  { key: "todo", name: "To Do", color: "#94a3b8", items: [] },
  { key: "doing", name: "In Progress", color: "#4f46e5", items: [] },
  { key: "review", name: "Review", color: "#f59e0b", items: [] },
  { key: "done", name: "Done", color: "#16a34a", items: [] },
];

export const GANTT_SRC: {
  title: string; tag: string; who: string; start: number; len: number; color: string;
}[] = [];

/* ---------------- 공지사항 ---------------- */

export const NOTICE_CAT_COLORS: Record<string, [string, string]> = {
  경영: ["#f1f5f9", "#334155"], HR: ["#f5f3ff", "#6d28d9"],
  "IT/보안": ["#eff6ff", "#1d4ed8"], 복지: ["#f0fdf4", "#15803d"],
};

export const NOTICE_ALL: {
  cat: string; title: string; author: string; date: string; views: number; attach: boolean; unread: boolean;
}[] = [];

export const NOTICE_PINNED: {
  tag: string; title: string; body: string; author: string; date: string; views: string;
  accent: string; titleColor: string; icon: string;
  bg: string; border: string; chip: [string, string];
}[] = [];

export const NOTICE_CATEGORIES = ["전체"];

/* ---------------- 알림 센터 ---------------- */

export const NOTIFS: {
  id: string; cat: string; title: string; desc: string; time: string; to: string; icon: string;
}[] = [];

export const NOTIF_CAT_COLORS: Record<string, [string, string, string]> = {
  결재: ["#eef2ff", "#4338ca", "#4f46e5"],
  근태: ["#f0fdf4", "#15803d", "#16a34a"],
  공지: ["#fff7ed", "#c2410c", "#ea580c"],
};

/* ---------------- 설정 ---------------- */

/**
 * 권한 행렬 — 기능(행) × 역할(열).
 * cells 값: 0 = 없음 · 1 = 부분 허용 · 2 = 허용.
 * 아래 값은 권장 기본값이며, `workspace/main.rbac` 에 저장된 오버라이드가 있으면 그쪽을 씁니다.
 */
export const RBAC_ROWS: {
  key: string;
  label: string;
  hint: string;
  cells: number[];
}[] = [
  { key: "workspace", label: "워크스페이스 설정 변경", hint: "회사 정보 · 보안 정책 · 연동", cells: [2, 1, 0, 0] },
  { key: "members", label: "멤버 초대 및 권한 부여", hint: "계정 승인 · 역할 변경", cells: [2, 2, 0, 0] },
  { key: "approvalForms", label: "전자결재 양식 관리", hint: "양식 생성 · 결재선 정책", cells: [2, 2, 1, 0] },
  { key: "attendanceApprove", label: "부서 근태 조회 및 승인", hint: "팀원 출퇴근 · 연차 승인", cells: [2, 2, 2, 0] },
  { key: "notice", label: "공지사항 작성 및 고정", hint: "전사 공지 · 필독 지정", cells: [2, 2, 1, 0] },
  { key: "selfService", label: "개인 근태 · 결재 사용", hint: "본인 문서 상신 및 조회", cells: [2, 2, 2, 2] },
];

export const ROLE_COLS = ["Super Admin", "Admin", "Manager", "Member"];

/** RBAC_ROWS 의 권장 기본값을 { rowKey: cells[] } 형태로 */
export const DEFAULT_RBAC: Record<string, number[]> = Object.fromEntries(
  RBAC_ROWS.map((r) => [r.key, [...r.cells]]),
);

export const RBAC_CELL_LABELS = ["없음", "부분", "허용"];

export const PENDING_MEMBERS: {
  name: string; role: string; email: string; dept: string; requested: string;
}[] = [];

export const COMPANY_FIELDS: { label: string; value: string }[] = [
  { label: "회사명", value: "" },
  { label: "사업자등록번호", value: "" },
  { label: "대표이사", value: "" },
  { label: "본사 주소", value: "" },
  { label: "대표 전화", value: "" },
  { label: "회계연도 시작", value: "" },
];

/** 접속 기기 목록은 실제 데이터(Firestore `sessions` 컬렉션, useSessions())로 대체됨 */

/** 알림 종류(키·라벨)만 유지 — on 기본값과 webhook 연동 상태는 계정별 실데이터 */
export const NOTIFY_GROUPS: {
  title: string; desc: string; icon: string; bg: string; color: string;
  webhook?: string;
  rows: { key: string; label: string; hint: string; on: boolean }[];
}[] = [
  {
    title: "서비스 내 알림", desc: "그룹웨어 헤더 벨 아이콘으로 표시됩니다", icon: "Bell", bg: "#eef2ff", color: "#4f46e5",
    rows: [
      { key: "appAttendance", label: "출퇴근", hint: "출근 미기록 · 퇴근 알림 (18:00)", on: false },
      { key: "appApproval", label: "결재 요청", hint: "내 결재 차례 · 반려 · 완결 알림", on: false },
      { key: "appNotice", label: "공지사항", hint: "필독 공지 등록 시 즉시 알림", on: false },
      { key: "appMention", label: "멘션 및 코멘트", hint: "Task · 문서에서 나를 멘션한 경우", on: false },
    ],
  },
  {
    title: "이메일 알림", desc: "로그인 계정 이메일로 발송됩니다", icon: "Mail", bg: "#ecfeff", color: "#0e7490",
    rows: [
      { key: "mailApproval", label: "결재 요청", hint: "결재 대기 문서 발생 시 즉시 발송", on: false },
      { key: "mailNotice", label: "공지사항", hint: "전사 공지 등록 시 요약 발송", on: false },
      { key: "mailWeekly", label: "주간 근태 리포트", hint: "매주 월요일 09:00 발송", on: false },
    ],
  },
  {
    title: "외부 메신저 웹훅", desc: "연동한 메신저 채널로 전송", icon: "Webhook", bg: "#f5f3ff", color: "#6d28d9",
    rows: [
      { key: "hookApproval", label: "결재 요청", hint: "멘션과 함께 채널에 전송", on: false },
      { key: "hookAttendance", label: "출퇴근", hint: "팀 채널 데일리 체크인 전송", on: false },
      { key: "hookNotice", label: "공지사항", hint: "필독 공지만 전송", on: false },
    ],
  },
];

/* ---------------- 자원 예약 ---------------- */

export type ResourceType = "회의실" | "법인 차량" | "프로젝트 랩탑" | "빔프로젝터";

export const RES_TYPES: { label: ResourceType; icon: string }[] = [
  { label: "회의실", icon: "DoorOpen" },
  { label: "법인 차량", icon: "Car" },
  { label: "프로젝트 랩탑", icon: "Laptop" },
  { label: "빔프로젝터", icon: "Projector" },
];

export const RES_CAP_FILTERS = ["전체", "4인실", "8인실", "20인 대회의실"];
export const RES_CAP_MAP: Record<string, number> = {
  "4인실": 4,
  "8인실": 8,
  "20인 대회의실": 20,
};
export const RES_EQUIP_FILTERS = ["TV", "화상회의 카메라", "빔프로젝터", "화이트보드"];

export interface Resource {
  key: string;
  type: ResourceType;
  name: string;
  cap: number;
  meta: string;
  equip: string[];
  icon: string;
}

/**
 * 예약 가능한 자원 목록.
 * 인물·문서 같은 "레코드"가 아니라 워크스페이스 설비 구성이므로
 * (TASK_COLUMNS·FORM_TEMPLATES 처럼) 정적으로 둡니다.
 */
export const RESOURCES: Resource[] = [
  { key: "mr-a", type: "회의실", name: "회의실 A", cap: 4, meta: "본사 7F · 창가", equip: ["TV", "화이트보드"], icon: "DoorOpen" },
  { key: "mr-b", type: "회의실", name: "회의실 B", cap: 4, meta: "본사 7F", equip: ["TV", "화상회의 카메라"], icon: "DoorOpen" },
  { key: "mr-focus", type: "회의실", name: "포커스룸", cap: 8, meta: "본사 8F", equip: ["TV", "화상회의 카메라", "화이트보드"], icon: "DoorOpen" },
  { key: "mr-hall", type: "회의실", name: "대회의실", cap: 20, meta: "본사 3F", equip: ["TV", "화상회의 카메라", "빔프로젝터", "화이트보드"], icon: "DoorOpen" },
  { key: "car-carnival", type: "법인 차량", name: "카니발 (12허 3456)", cap: 7, meta: "지하 1층 B-02", equip: [], icon: "Car" },
  { key: "car-ioniq", type: "법인 차량", name: "아이오닉6 (30호 7788)", cap: 5, meta: "지하 1층 B-05", equip: [], icon: "Car" },
  { key: "laptop-mbp-1", type: "프로젝트 랩탑", name: "MacBook Pro 16″ #1", cap: 1, meta: "IT지원팀 대여", equip: [], icon: "Laptop" },
  { key: "laptop-mbp-2", type: "프로젝트 랩탑", name: "MacBook Pro 16″ #2", cap: 1, meta: "IT지원팀 대여", equip: [], icon: "Laptop" },
  { key: "proj-epson", type: "빔프로젝터", name: "Epson EB-2247U", cap: 1, meta: "총무팀 대여", equip: ["빔프로젝터"], icon: "Projector" },
];

/** 08:00–20:00, 30분 단위 = 24슬롯 */
export const BOOKING_SLOTS = 24;

export function slotLabel(i: number): string {
  const h = 8 + Math.floor(i / 2);
  return `${String(h).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
}

export interface Booking {
  res: string;
  from: number;
  to: number;
  title: string;
  who: string;
}

export const INITIAL_BOOKINGS: Booking[] = [];

export const BOOK_PURPOSES = ["정기 회의", "고객 미팅", "면접", "교육"];
export const BOOK_PROVIDERS = ["Google Meet", "Zoom"];

/* 워크스페이스(회사) 기본값 — 실제 사용자 식별은 useCurrentUser() 사용 */
export const CURRENT_USER = {
  workspace: "",
};
