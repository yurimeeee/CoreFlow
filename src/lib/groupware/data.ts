/**
 * CoreFlow 그룹웨어 — 데모 목(mock) 데이터
 * "기업용 그룹웨어 대시보드" 디자인(Claude Design)의 프리뷰 데이터를 이식.
 * 실제 서비스에서는 Firestore 컬렉션으로 대체됩니다.
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

export const PEOPLE: Person[] = [
  { id: 1, name: "한지훈", role: "CTO", dept: "기술본부", team: "기술본부", email: "jihoon.han@nextcore.io", ext: "2100", mobile: "010-2841-1102", status: "online", boss: 0, tags: ["기술전략", "보안", "아키텍처"] },
  { id: 2, name: "김세진", role: "과장", dept: "기술본부 · 플랫폼개발팀", team: "플랫폼개발팀", email: "sejin.kim@nextcore.io", ext: "2107", mobile: "010-3320-7741", status: "online", boss: 1, tags: ["결재엔진", "근태", "그룹웨어"] },
  { id: 3, name: "정민준", role: "과장", dept: "기술본부 · 플랫폼개발팀", team: "플랫폼개발팀", email: "minjun.jung@nextcore.io", ext: "2112", mobile: "010-7745-2210", status: "remote", boss: 1, tags: ["API", "배치", "성능"] },
  { id: 4, name: "박서윤", role: "사원", dept: "기술본부 · 프론트엔드팀", team: "프론트엔드팀", email: "seoyoon.park@nextcore.io", ext: "2203", mobile: "010-2245-9930", status: "away", boss: 1, tags: ["대시보드", "반응형"] },
  { id: 5, name: "이도현", role: "대리", dept: "기술본부 · 프론트엔드팀", team: "프론트엔드팀", email: "dohyun.lee@nextcore.io", ext: "2205", mobile: "010-5512-8820", status: "remote", boss: 1, tags: ["조직도", "렌더링 성능"] },
  { id: 6, name: "최유나", role: "사원", dept: "기술본부 · QA팀", team: "QA팀", email: "yuna.choi@nextcore.io", ext: "2301", mobile: "010-8890-3312", status: "online", boss: 1, tags: ["회귀테스트", "자동화"] },
  { id: 7, name: "윤아름", role: "대리", dept: "디자인본부 · 프로덕트디자인팀", team: "프로덕트디자인팀", email: "areum.yoon@nextcore.io", ext: "2402", mobile: "010-3345-7781", status: "remote", boss: 11, tags: ["디자인시스템", "UX 리서치"] },
  { id: 8, name: "강태오", role: "팀장", dept: "마케팅본부 · 마케팅팀", team: "마케팅팀", email: "taeo.kang@nextcore.io", ext: "3302", mobile: "010-9921-4478", status: "online", boss: 12, tags: ["퍼포먼스", "브랜드"] },
  { id: 9, name: "오세라", role: "팀장", dept: "경영지원본부 · 인사팀", team: "인사팀", email: "sera.oh@nextcore.io", ext: "3102", mobile: "010-4417-2093", status: "leave", boss: 10, tags: ["채용", "인사평가"] },
  { id: 10, name: "배현수", role: "본부장", dept: "경영지원본부", team: "경영지원본부", email: "hyunsoo.bae@nextcore.io", ext: "3001", mobile: "010-2277-6650", status: "online", boss: 0, tags: ["경영기획", "재무"] },
  { id: 11, name: "문가영", role: "본부장", dept: "디자인본부", team: "디자인본부", email: "gayoung.moon@nextcore.io", ext: "2400", mobile: "010-6612-3389", status: "online", boss: 0, tags: ["프로덕트 디자인", "브랜딩"] },
  { id: 12, name: "서준혁", role: "본부장", dept: "마케팅본부", team: "마케팅본부", email: "junhyuk.seo@nextcore.io", ext: "3300", mobile: "010-7788-1120", status: "away", boss: 0, tags: ["그로스", "파트너십"] },
  { id: 13, name: "신유리", role: "사원", dept: "경영지원본부 · 총무팀", team: "총무팀", email: "yuri.shin@nextcore.io", ext: "3205", mobile: "010-1123-4456", status: "online", boss: 10, tags: ["총무", "복리후생"] },
  { id: 0, name: "노정헌", role: "대표이사", dept: "넥스트코어", team: "경영진", email: "ceo@nextcore.io", ext: "1000", mobile: "—", status: "online", boss: null, tags: ["경영 총괄"] },
];

export const personById = (id: number) => PEOPLE.find((p) => p.id === id);

export const DEPT_TREE = [
  { name: "넥스트코어 (대표이사)", count: 46, depth: 0, key: "전체" },
  { name: "기술본부", count: 23, depth: 1, key: "기술본부" },
  { name: "플랫폼개발팀", count: 12, depth: 2, key: "플랫폼개발팀" },
  { name: "프론트엔드팀", count: 7, depth: 2, key: "프론트엔드팀" },
  { name: "QA팀", count: 4, depth: 2, key: "QA팀" },
  { name: "디자인본부", count: 7, depth: 1, key: "디자인본부" },
  { name: "프로덕트디자인팀", count: 6, depth: 2, key: "프로덕트디자인팀" },
  { name: "마케팅본부", count: 8, depth: 1, key: "마케팅본부" },
  { name: "마케팅팀", count: 7, depth: 2, key: "마케팅팀" },
  { name: "경영지원본부", count: 8, depth: 1, key: "경영지원본부" },
  { name: "인사팀", count: 5, depth: 2, key: "인사팀" },
  { name: "총무팀", count: 3, depth: 2, key: "총무팀" },
];

export const DEPT_FILTERS = ["전체", "플랫폼개발팀", "프론트엔드팀", "프로덕트디자인팀", "마케팅팀", "인사팀"];

export const ORG_BRANCHES = [
  { head: 1, dept: "기술본부", teams: [["플랫폼개발팀", 12], ["프론트엔드팀", 7], ["QA팀", 4]] as [string, number][] },
  { head: 11, dept: "디자인본부", teams: [["프로덕트디자인팀", 6]] as [string, number][] },
  { head: 12, dept: "마케팅본부", teams: [["마케팅팀", 7]] as [string, number][] },
  { head: 10, dept: "경영지원본부", teams: [["인사팀", 5], ["총무팀", 3]] as [string, number][] },
];

/* ---------------- 대시보드 ---------------- */

export const DASH_NOTICES = [
  { title: "2026년 하반기 정보보안 교육 필수 이수 안내", dept: "정보보안팀", date: "09.01", must: true },
  { title: "추석 연휴 근무 및 대체휴무 신청 안내", dept: "인사팀", date: "08.28", must: true },
  { title: "사내 그룹웨어 v3.2 배포 — 결재선 자동 지정 기능 추가", dept: "플랫폼개발팀", date: "08.26", must: false },
  { title: "4분기 조직개편 사전 안내", dept: "경영지원실", date: "08.22", must: false },
];

export const DASH_TASKS = [
  { id: 1, title: "결재 라인 정책 스펙 리뷰", tag: "기획", due: "09.02", dday: "D-Day", done: false },
  { id: 3, title: "출퇴근 API 예외 처리", tag: "개발", due: "09.02", dday: "D-Day", done: false },
  { id: 2, title: "Q3 인사평가 데이터 정리", tag: "HR", due: "09.04", dday: "D-2", done: false },
  { id: 4, title: "조직도 트리 성능 개선", tag: "개발", due: "09.05", dday: "D-3", done: false },
  { id: 5, title: "주간 업무보고 상신", tag: "보고", due: "09.01", dday: "D+1", done: true },
  { id: 6, title: "보안 교육 이수", tag: "필수", due: "08.31", dday: "D+2", done: true },
];

export const DASH_SCHEDULE = [
  { time: "10:00", title: "플랫폼 주간 스프린트 회의", place: "본사 7F 회의실 A", color: "#4f46e5" },
  { time: "13:30", title: "결재 정책 유관부서 리뷰", place: "온라인 (Meet)", color: "#6366f1" },
  { time: "15:00", title: "신규 입사자 온보딩 멘토링", place: "본사 5F 라운지", color: "#16a34a" },
  { time: "17:00", title: "주간 업무보고 상신 마감", place: "전자결재", color: "#f59e0b" },
];

export const DASH_APPROVALS = [
  { type: "휴가", title: "연차 휴가 신청서 (9/12)", state: "Waiting" },
  { type: "지출", title: "3분기 팀 워크숍 비용 집행", state: "Waiting" },
  { type: "품의", title: "개발 서버 증설 품의서", state: "Processing" },
];

/* ---------------- 근태 ---------------- */

export const ATT_DAY_DATA: Record<number, [string, string, string]> = {
  1: ["09:04", "18:20", "정상"], 2: ["09:02", "19:10", "정상"], 3: ["09:31", "18:45", "지각"],
  4: ["08:52", "18:05", "정상"], 7: ["09:00", "18:00", "재택"], 8: ["—", "—", "연차"],
  9: ["08:58", "20:40", "연장"], 10: ["09:12", "18:30", "정상"], 11: ["09:05", "18:10", "정상"],
  14: ["09:00", "18:00", "정상"], 15: ["09:22", "19:30", "지각"], 16: ["—", "—", "연차"],
  17: ["08:47", "18:12", "정상"], 18: ["09:01", "21:05", "연장"], 21: ["09:03", "18:08", "정상"],
  22: ["08:55", "18:02", "재택"], 23: ["09:08", "18:40", "정상"], 24: ["09:00", "19:50", "연장"],
  25: ["09:02", "18:15", "정상"], 28: ["09:06", "18:20", "정상"], 29: ["09:00", "18:00", "정상"],
  30: ["09:10", "18:35", "정상"],
};

export const ATT_TYPE_COLORS: Record<string, [string, string, string]> = {
  정상: ["#eef2ff", "#4338ca", "#4f46e5"],
  지각: ["#fff7ed", "#c2410c", "#f59e0b"],
  연차: ["#f1f5f9", "#475569", "#94a3b8"],
  연장: ["#fef2f2", "#b91c1c", "#e11d48"],
  재택: ["#f0fdf4", "#15803d", "#16a34a"],
};

export const ATT_ROWS = [
  { day: "09.02 (수)", in: "09:02", out: "19:10", hours: "9.1h", pct: 92, type: "정상", color: "#4f46e5" },
  { day: "09.01 (화)", in: "09:04", out: "18:20", hours: "8.3h", pct: 84, type: "정상", color: "#4f46e5" },
  { day: "08.29 (금)", in: "09:31", out: "18:45", hours: "8.2h", pct: 82, type: "지각", color: "#f59e0b" },
  { day: "08.28 (목)", in: "08:58", out: "20:40", hours: "10.7h", pct: 100, type: "연장", color: "#e11d48" },
  { day: "08.27 (수)", in: "09:00", out: "18:00", hours: "8.0h", pct: 80, type: "재택", color: "#16a34a" },
  { day: "08.26 (화)", in: "—", out: "—", hours: "0.0h", pct: 0, type: "연차", color: "#94a3b8" },
];

export const LEAVE_HISTORY = [
  { type: "연차", date: "2026.08.14 – 08.15", days: "2일" },
  { type: "반차", date: "2026.07.31 (오후)", days: "0.5일" },
  { type: "연차", date: "2026.07.06 – 07.08", days: "2.5일" },
];

/* ---------------- 전자결재 ---------------- */

export const APPROVAL_STATS = [
  { label: "결재 대기", value: 3, color: "#4f46e5", bg: "#eef2ff", icon: "Inbox" },
  { label: "진행 중", value: 1, color: "#0f172a", bg: "#f1f5f9", icon: "Loader" },
  { label: "완료", value: 12, color: "#0f172a", bg: "#f0fdf4", icon: "CircleCheck" },
  { label: "반려", value: 0, color: "#94a3b8", bg: "#fef2f2", icon: "CircleX" },
];

export const APPROVAL_TABS = ["대기 문서 3", "기안 문서 5", "참조 문서 8"];

export type ApprovalRow = {
  no: string; type: string; title: string; author: string; date: string; approver: string; status: string;
};

export const APPROVAL_ROWS: ApprovalRow[][] = [
  [
    { no: "EX-2026-0912", type: "지출", title: "3분기 팀 워크숍 비용 집행 요청", author: "박서윤 사원", date: "09.01", approver: "이현우 팀장", status: "Waiting" },
    { no: "HR-2026-0455", type: "휴가", title: "연차 휴가 신청서 (2026-09-12)", author: "이도현 대리", date: "09.01", approver: "이현우 팀장", status: "Waiting" },
    { no: "PR-2026-0231", type: "품의", title: "개발 서버 증설 품의서 (AWS)", author: "정민준 과장", date: "08.31", approver: "한지훈 CTO", status: "Waiting" },
  ],
  [
    { no: "RP-2026-0781", type: "보고", title: "8월 플랫폼개발팀 월간 업무보고", author: "김세진 과장", date: "08.31", approver: "배현수 본부장", status: "In Progress" },
    { no: "EX-2026-0888", type: "지출", title: "외부 컨설팅 계약 검토 요청", author: "김세진 과장", date: "08.26", approver: "법무팀 윤아름", status: "Approved" },
    { no: "HR-2026-0402", type: "인사", title: "하반기 직무 교육 수강 신청", author: "김세진 과장", date: "08.20", approver: "오세라 팀장", status: "Approved" },
    { no: "PR-2026-0198", type: "품의", title: "모니터링 SaaS 도입 품의서", author: "김세진 과장", date: "08.14", approver: "한지훈 CTO", status: "Approved" },
    { no: "EX-2026-0760", type: "지출", title: "7월 개발도서 구입 정산", author: "김세진 과장", date: "08.05", approver: "재무팀 조민아", status: "Rejected" },
  ],
  [
    { no: "RP-2026-0790", type: "보고", title: "전사 보안 점검 결과 보고", author: "한지훈 CTO", date: "08.29", approver: "대표이사", status: "Approved" },
    { no: "HR-2026-0450", type: "인사", title: "3분기 신규 입사자 배치 안내", author: "오세라 팀장", date: "08.27", approver: "배현수 본부장", status: "Approved" },
    { no: "EX-2026-0870", type: "지출", title: "사내 카페테리아 위탁 계약 갱신", author: "신유리 사원", date: "08.25", approver: "조민아 팀장", status: "In Progress" },
    { no: "PR-2026-0225", type: "품의", title: "노트북 일괄 교체 품의서", author: "정민준 과장", date: "08.21", approver: "한지훈 CTO", status: "Waiting" },
    { no: "RP-2026-0774", type: "보고", title: "2분기 경영실적 요약", author: "배현수 본부장", date: "08.11", approver: "대표이사", status: "Approved" },
  ],
];

export const APPROVAL_TYPE_COLORS: Record<string, [string, string]> = {
  휴가: ["#eef2ff", "#4338ca"], 지출: ["#f0fdf4", "#15803d"], 품의: ["#fff7ed", "#c2410c"],
  보고: ["#f1f5f9", "#475569"], 인사: ["#f5f3ff", "#6d28d9"],
};

export const APPROVAL_STATUS_COLORS: Record<string, [string, string]> = {
  Waiting: ["#fff7ed", "#c2410c"], "In Progress": ["#eef2ff", "#4338ca"],
  Approved: ["#f0fdf4", "#15803d"], Rejected: ["#fef2f2", "#b91c1c"],
};

/* 결재 문서 상세 (EX-2026-0912) */
export const DETAIL_LINE = [
  { kind: "기안", name: "박서윤", role: "사원 · 마케팅팀", state: "기안", at: "09.01 09:12", done: true },
  { kind: "결재", name: "강태오", role: "팀장 · 마케팅팀", state: "승인", at: "09.01 11:40", done: true },
  { kind: "합의", name: "조민아", role: "팀장 · 재무팀", state: "합의 완료", at: "09.02 10:05", done: true },
  { kind: "결재", name: "김세진", role: "과장 · 플랫폼개발팀", state: "결재 대기", at: "", done: false },
  { kind: "참조", name: "배현수", role: "본부장 · 경영지원", state: "참조", at: "", done: false },
];

export const DETAIL_META = [
  { label: "문서번호", value: "EX-2026-0912" },
  { label: "기안자", value: "박서윤 사원" },
  { label: "기안부서", value: "마케팅본부 · 마케팅팀" },
  { label: "기안일자", value: "2026.09.01" },
  { label: "보안등급", value: "일반" },
  { label: "보존연한", value: "5년" },
];

export const DETAIL_ROWS = [
  { date: "2026.08.21", desc: "팀 워크숍 숙박비 (2실 2박)", amount: 640000, receipt: "첨부" },
  { date: "2026.08.21", desc: "워크숍 식대 (12인)", amount: 384000, receipt: "첨부" },
  { date: "2026.08.22", desc: "이동 차량 렌트 (승합 1대)", amount: 176000, receipt: "전표" },
];

export const DETAIL_COMMENTS = [
  { name: "강태오", role: "팀장 · 마케팅팀", at: "09.01 11:40", body: "워크숍 예산 범위 내 집행 확인했습니다. 승인합니다." },
  { name: "조민아", role: "팀장 · 재무팀", at: "09.02 10:05", body: "차량 렌트 건은 카드 전표로 대체 증빙 처리했습니다. 원본 영수증 확보 시 회계팀으로 전달 부탁드립니다." },
];

export const DETAIL_ATTACHMENTS = [
  { name: "워크숍_숙박_영수증.pdf", size: "842 KB", kind: "pdf" },
  { name: "식대_카드전표_20260821.jpg", size: "1.4 MB", kind: "img" },
];

/* 기안 양식 */
export const FORM_TEMPLATES: { name: string; desc: string; icon: string }[] = [
  { name: "지출결의서", desc: "경비 집행 및 정산 · 재무팀 경유", icon: "Receipt" },
  { name: "휴가신청서", desc: "연차 / 반차 / 경조 휴가 신청", icon: "Palmtree" },
  { name: "품의서", desc: "구매 · 계약 · 도입 사전 승인", icon: "FileSignature" },
  { name: "업무보고서", desc: "주간 / 월간 업무 실적 보고", icon: "FileBarChart" },
  { name: "근무시간 변경 신청", desc: "유연근무 시간대 변경 요청", icon: "Clock4" },
  { name: "구매요청서", desc: "비품 · 장비 · 소프트웨어 구매", icon: "ShoppingCart" },
];

export const DRAFT_APPROVAL_LINE = [
  { kind: "기안", name: "김세진", role: "과장 · 플랫폼개발팀", state: "기안 완료", mark: "김" },
  { kind: "결재", name: "이현우", role: "팀장 · 플랫폼개발팀", state: "대기", mark: "" },
  { kind: "결재", name: "한지훈", role: "이사 · 기술본부", state: "대기", mark: "" },
  { kind: "합의", name: "조민아", role: "팀장 · 재무팀", state: "합의 대기", mark: "" },
  { kind: "참조", name: "배현수", role: "본부장 · 경영지원", state: "참조", mark: "" },
];

export const DRAFT_META = [
  { label: "기안자", value: "김세진 과장" },
  { label: "기안 부서", value: "기술본부 · 플랫폼개발팀" },
  { label: "기안 일자", value: "2026.09.03" },
  { label: "문서 번호", value: "EX-2026-0931 (자동 생성)" },
];

export const EXPENSE_ROWS = [
  { id: 1, date: "2026.08.21", desc: "팀 워크숍 숙박비", amount: "640,000", receipt: "첨부" },
  { id: 2, date: "2026.08.21", desc: "워크숍 식대 (12인)", amount: "384,000", receipt: "첨부" },
  { id: 3, date: "2026.08.22", desc: "이동 차량 렌트", amount: "176,000", receipt: "미첨부" },
];

export const PURCHASE_ROWS = [
  { id: 1, name: "개발용 노트북", spec: "MacBook Pro 14 M4", qty: "2", price: "2,890,000" },
  { id: 2, name: "외장 모니터", spec: "27인치 4K", qty: "4", price: "520,000" },
  { id: 3, name: "도킹 스테이션", spec: "Thunderbolt 4", qty: "4", price: "210,000" },
];

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

export const BOARD: BoardCol[] = [
  { key: "todo", name: "To Do", color: "#94a3b8", items: [
    { id: 11, tag: "UI/UX", title: "근태 캘린더 뷰 인터랙션 정의", who: "김세진", dday: "D-3", done: 0, total: 4 },
    { id: 12, tag: "Backend", title: "결재선 자동 지정 룰 엔진 설계", who: "정민준", dday: "D-5", done: 1, total: 6 },
  ] },
  { key: "doing", name: "In Progress", color: "#4f46e5", items: [
    { id: 13, tag: "Backend", title: "출퇴근 기록 API 예외 처리", who: "정민준", dday: "D-Day", done: 2, total: 5 },
    { id: 14, tag: "Frontend", title: "대시보드 위젯 반응형 대응", who: "박서윤", dday: "D-1", done: 3, total: 5 },
    { id: 15, tag: "UI/UX", title: "공지사항 게시판 리디자인", who: "최유나", dday: "D-4", done: 1, total: 3 },
  ] },
  { key: "review", name: "Review", color: "#f59e0b", items: [
    { id: 16, tag: "Frontend", title: "조직도 트리 가상 스크롤 적용", who: "이도현", dday: "D+1", done: 4, total: 5 },
    { id: 17, tag: "QA", title: "전자결재 회귀 테스트 시나리오", who: "최유나", dday: "D-2", done: 6, total: 8 },
  ] },
  { key: "done", name: "Done", color: "#16a34a", items: [
    { id: 18, tag: "Backend", title: "주 52시간 집계 배치 개선", who: "정민준", dday: "완료", done: 5, total: 5 },
    { id: 19, tag: "UI/UX", title: "사이드바 다크 테마 토큰 정리", who: "김세진", dday: "완료", done: 3, total: 3 },
  ] },
];

export const GANTT_SRC = [
  { title: "근태 캘린더 뷰 인터랙션", tag: "UI/UX", who: "김세진", start: 0, len: 4, color: "#7c3aed" },
  { title: "결재선 자동 지정 룰 엔진", tag: "Backend", who: "정민준", start: 2, len: 6, color: "#1d4ed8" },
  { title: "출퇴근 API 예외 처리", tag: "Backend", who: "정민준", start: 1, len: 3, color: "#4f46e5" },
  { title: "대시보드 위젯 반응형", tag: "Frontend", who: "박서윤", start: 3, len: 4, color: "#0e7490" },
  { title: "조직도 트리 가상 스크롤", tag: "Frontend", who: "이도현", start: 5, len: 5, color: "#0e7490" },
  { title: "전자결재 회귀 테스트", tag: "QA", who: "최유나", start: 8, len: 6, color: "#c2410c" },
];

/* ---------------- 공지사항 ---------------- */

export const NOTICE_CAT_COLORS: Record<string, [string, string]> = {
  경영: ["#f1f5f9", "#334155"], HR: ["#f5f3ff", "#6d28d9"],
  "IT/보안": ["#eff6ff", "#1d4ed8"], 복지: ["#f0fdf4", "#15803d"],
};

export const NOTICE_ALL = [
  { cat: "IT/보안", title: "2026년 하반기 정보보안 교육 필수 이수 안내", author: "정보보안팀 한지훈", date: "09.01", views: 412, attach: true, unread: true },
  { cat: "HR", title: "추석 연휴 근무 및 대체휴무 신청 안내", author: "인사팀 오세라", date: "08.28", views: 508, attach: true, unread: true },
  { cat: "IT/보안", title: "사내 그룹웨어 v3.2 배포 — 결재선 자동 지정 기능 추가", author: "플랫폼개발팀 김세진", date: "08.26", views: 236, attach: false, unread: true },
  { cat: "경영", title: "4분기 조직개편 사전 안내", author: "경영지원실 배현수", date: "08.22", views: 731, attach: false, unread: false },
  { cat: "복지", title: "사내 카페테리아 메뉴 및 운영시간 변경", author: "총무팀 신유리", date: "08.20", views: 189, attach: false, unread: false },
  { cat: "HR", title: "2026년 하반기 승진 심사 일정 공고", author: "인사팀 오세라", date: "08.18", views: 645, attach: true, unread: false },
  { cat: "복지", title: "건강검진 예약 오픈 안내 (9/1~10/31)", author: "총무팀 신유리", date: "08.15", views: 302, attach: true, unread: false },
  { cat: "경영", title: "2분기 경영실적 공유 및 타운홀 미팅", author: "경영지원실 배현수", date: "08.11", views: 522, attach: false, unread: false },
];

export const NOTICE_PINNED = [
  {
    tag: "IT/보안", title: "전사 정보보안 교육 필수 이수 (9/15 마감)",
    body: "전 임직원 대상 필수 교육입니다. 기한 내 미이수 시 인사평가에 반영되며, 그룹웨어 > 교육 메뉴에서 수강할 수 있습니다.",
    author: "정보보안팀 한지훈", date: "2026.09.01", views: "412",
    accent: "#dc2626", titleColor: "#7f1d1d", icon: "ShieldAlert",
    bg: "#fef2f2", border: "#fecaca", chip: ["#fee2e2", "#b91c1c"] as [string, string],
  },
  {
    tag: "HR", title: "추석 연휴 근무 및 대체휴무 신청 안내",
    body: "9월 25일(금)은 전사 대체휴무입니다. 부서별 필수 근무 인원은 9월 12일까지 근태 시스템으로 신청해 주세요.",
    author: "인사팀 오세라", date: "2026.08.28", views: "508",
    accent: "#ea580c", titleColor: "#7c2d12", icon: "CalendarClock",
    bg: "#fff7ed", border: "#fed7aa", chip: ["#ffedd5", "#c2410c"] as [string, string],
  },
];

export const NOTICE_CATEGORIES = ["전체", "경영", "HR", "IT/보안", "복지"];

/* ---------------- 알림 센터 ---------------- */

export const NOTIFS = [
  { id: "n1", cat: "결재", title: "연차 휴가 신청서 결재 요청", desc: "이도현 대리가 상신한 문서가 내 결재 차례입니다", time: "5분 전", to: "/approval/EX-2026-0912", icon: "FileCheck2" },
  { id: "n2", cat: "결재", title: "지출결의서가 반려되었습니다", desc: "조민아 팀장 · 증빙 영수증 재첨부 요청", time: "32분 전", to: "/approval", icon: "CircleX" },
  { id: "n3", cat: "근태", title: "퇴근 기록이 필요합니다", desc: "어제 퇴근 기록이 누락되었습니다 (09.02)", time: "2시간 전", to: "/attendance", icon: "Clock" },
  { id: "n4", cat: "공지", title: "필독 공지가 등록되었습니다", desc: "전사 정보보안 교육 필수 이수 (9/15 마감)", time: "어제 17:20", to: "/notice", icon: "Megaphone" },
  { id: "n5", cat: "근태", title: "초과근무 신청이 승인되었습니다", desc: "이현우 팀장 · 09.01 3시간 승인", time: "어제 10:04", to: "/attendance", icon: "Timer" },
  { id: "n6", cat: "결재", title: "품의서 결재가 완결되었습니다", desc: "개발 서버 증설 품의서 · 한지훈 CTO 승인", time: "08.31", to: "/approval", icon: "CircleCheck" },
  { id: "n7", cat: "공지", title: "추석 연휴 근무 신청 마감 D-9", desc: "인사팀 · 09.12까지 근태 시스템에서 신청", time: "08.29", to: "/notice", icon: "CalendarClock" },
];

export const NOTIF_CAT_COLORS: Record<string, [string, string, string]> = {
  결재: ["#eef2ff", "#4338ca", "#4f46e5"],
  근태: ["#f0fdf4", "#15803d", "#16a34a"],
  공지: ["#fff7ed", "#c2410c", "#ea580c"],
};

/* ---------------- 설정 ---------------- */

export const RBAC_ROWS = [
  { label: "워크스페이스 설정 변경", hint: "회사 정보 · 보안 정책 · 연동", cells: [2, 1, 0, 0] },
  { label: "멤버 초대 및 권한 부여", hint: "계정 승인 · 역할 변경", cells: [2, 2, 0, 0] },
  { label: "전자결재 양식 관리", hint: "양식 생성 · 결재선 정책", cells: [2, 2, 1, 0] },
  { label: "부서 근태 조회 및 승인", hint: "팀원 출퇴근 · 연차 승인", cells: [2, 2, 2, 0] },
  { label: "공지사항 작성 및 고정", hint: "전사 공지 · 필독 지정", cells: [2, 2, 1, 0] },
  { label: "개인 근태 · 결재 사용", hint: "본인 문서 상신 및 조회", cells: [2, 2, 2, 2] },
];

export const ROLE_COLS = ["Super Admin", "Admin", "Manager", "Member"];

export const PENDING_MEMBERS = [
  { name: "한도윤", role: "사원", email: "doyoon.han@nextcore.io", dept: "프론트엔드팀", requested: "09.02 신청" },
  { name: "류지아", role: "대리", email: "jia.ryu@nextcore.io", dept: "마케팅팀", requested: "09.01 신청" },
  { name: "고은성", role: "사원", email: "eunsung.ko@nextcore.io", dept: "총무팀", requested: "08.31 신청" },
];

export const COMPANY_FIELDS = [
  { label: "회사명", value: "주식회사 넥스트코어" },
  { label: "사업자등록번호", value: "214-88-01102" },
  { label: "대표이사", value: "노정헌" },
  { label: "본사 주소", value: "서울 강남구 테헤란로 231" },
  { label: "대표 전화", value: "02-1588-2200" },
  { label: "회계연도 시작", value: "매년 1월 1일" },
];

export const INTEGRATIONS = [
  { name: "Slack", desc: "결재 · 공지 알림을 채널로 전송", icon: "MessageSquare", bg: "#f5f3ff", color: "#6d28d9", on: true },
  { name: "Jandi", desc: "팀 토픽으로 근태 알림 전송", icon: "MessagesSquare", bg: "#ecfeff", color: "#0e7490", on: false },
  { name: "Google Calendar", desc: "사내 일정과 개인 캘린더 동기화", icon: "CalendarDays", bg: "#eef2ff", color: "#4338ca", on: true },
  { name: "Google Drive", desc: "결재 첨부파일을 드라이브에 보관", icon: "HardDrive", bg: "#f0fdf4", color: "#15803d", on: false },
];

export const SESSIONS = [
  { device: "MacBook Pro · Chrome 128", meta: "서울, 대한민국 · 211.44.20.118", time: "방금 전", current: true, icon: "Laptop" },
  { device: "iPhone 16 · 그룹웨어 앱", meta: "서울, 대한민국 · 121.190.8.44", time: "2시간 전", current: false, icon: "Smartphone" },
  { device: "Windows PC · Edge 127", meta: "판교, 대한민국 · 175.223.11.9", time: "어제 18:22", current: false, icon: "Monitor" },
  { device: "iPad Air · Safari", meta: "서울, 대한민국 · 121.190.8.44", time: "08.29 10:04", current: false, icon: "Tablet" },
];

export const NOTIFY_GROUPS = [
  {
    title: "서비스 내 알림", desc: "그룹웨어 헤더 벨 아이콘으로 표시됩니다", icon: "Bell", bg: "#eef2ff", color: "#4f46e5",
    rows: [
      { key: "appAttendance", label: "출퇴근", hint: "출근 미기록 · 퇴근 알림 (18:00)", on: true },
      { key: "appApproval", label: "결재 요청", hint: "내 결재 차례 · 반려 · 완결 알림", on: true },
      { key: "appNotice", label: "공지사항", hint: "필독 공지 등록 시 즉시 알림", on: true },
      { key: "appMention", label: "멘션 및 코멘트", hint: "Task · 문서에서 나를 멘션한 경우", on: true },
    ],
  },
  {
    title: "이메일 알림", desc: "sejin.kim@nextcore.io 로 발송됩니다", icon: "Mail", bg: "#ecfeff", color: "#0e7490",
    rows: [
      { key: "mailApproval", label: "결재 요청", hint: "결재 대기 문서 발생 시 즉시 발송", on: true },
      { key: "mailNotice", label: "공지사항", hint: "전사 공지 등록 시 요약 발송", on: false },
      { key: "mailWeekly", label: "주간 근태 리포트", hint: "매주 월요일 09:00 발송", on: true },
    ],
  },
  {
    title: "외부 메신저 웹훅", desc: "Slack #groupware 채널로 전송", icon: "Webhook", bg: "#f5f3ff", color: "#6d28d9",
    webhook: "Slack 연동됨",
    rows: [
      { key: "hookApproval", label: "결재 요청", hint: "멘션과 함께 채널에 전송", on: true },
      { key: "hookAttendance", label: "출퇴근", hint: "팀 채널 데일리 체크인 전송", on: false },
      { key: "hookNotice", label: "공지사항", hint: "필독 공지만 전송", on: true },
    ],
  },
];

/* 현재 사용자 (데모) */
export const CURRENT_USER = {
  name: "김세진",
  role: "과장",
  team: "플랫폼개발팀",
  dept: "기술본부 · 플랫폼개발팀",
  email: "sejin.kim@nextcore.io",
  workspace: "넥스트코어",
};
