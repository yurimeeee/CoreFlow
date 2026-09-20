/**
 * CoreFlow 그룹웨어 — 데모 시드 페이로드 (buildSeed 전용)
 *
 * data.ts 는 리팩터 이후 "구조 · 색상 · 라벨"만 들고 있고 실제 레코드가 없어서
 * (Firestore 가 비면 각 화면은 empty state) `/admin/seed` 가 만들 문서가 거의
 * 없었습니다. 이 파일은 데모/부트스트랩 때 Firestore 에 1회 밀어넣을 목데이터를
 * 담습니다. 앱 런타임 폴백으로는 쓰지 않습니다 — 오직 buildSeed() 에서만 참조.
 */
/* ------------------------------------------------------------------ */
/*  공지사항 (notices/{id})                                             */
/* ------------------------------------------------------------------ */

export const SEED_NOTICE_PINNED: {
  tag: string; title: string; body: string; author: string; date: string; views: string;
  accent: string; titleColor: string; icon: string;
  bg: string; border: string; chip: [string, string];
}[] = [
  {
    tag: "IT/보안", title: "전사 정보보안 교육 필수 이수 (9/15 마감)",
    body: "전 임직원 대상 필수 교육입니다. 기한 내 미이수 시 인사평가에 반영되며, 그룹웨어 > 교육 메뉴에서 수강할 수 있습니다.",
    author: "정보보안팀 한지훈", date: "2026.09.01", views: "412",
    accent: "#dc2626", titleColor: "#7f1d1d", icon: "ShieldAlert",
    bg: "#fef2f2", border: "#fecaca", chip: ["#fee2e2", "#b91c1c"],
  },
  {
    tag: "HR", title: "추석 연휴 근무 및 대체휴무 신청 안내",
    body: "9월 25일(금)은 전사 대체휴무입니다. 부서별 필수 근무 인원은 9월 12일까지 근태 시스템으로 신청해 주세요.",
    author: "인사팀 오세라", date: "2026.08.28", views: "508",
    accent: "#ea580c", titleColor: "#7c2d12", icon: "CalendarClock",
    bg: "#fff7ed", border: "#fed7aa", chip: ["#ffedd5", "#c2410c"],
  },
];

export const SEED_NOTICE_ALL: {
  cat: string; title: string; author: string; date: string; views: number; attach: boolean; unread: boolean;
  body: string;
}[] = [
  { cat: "IT/보안", title: "2026년 하반기 정보보안 교육 필수 이수 안내", author: "정보보안팀 한지훈", date: "09.01", views: 412, attach: true, unread: true, body: "하반기 정보보안 교육이 오픈되었습니다. 9월 15일까지 그룹웨어 교육 메뉴에서 전 과정을 이수해 주세요." },
  { cat: "HR", title: "추석 연휴 근무 및 대체휴무 신청 안내", author: "인사팀 오세라", date: "08.28", views: 508, attach: true, unread: true, body: "추석 연휴 및 대체휴무(9/25) 관련 부서별 근무 계획을 9월 12일까지 근태 시스템으로 제출해 주세요." },
  { cat: "IT/보안", title: "사내 그룹웨어 v3.2 배포 — 결재선 자동 지정 기능 추가", author: "플랫폼개발팀 김세진", date: "08.26", views: 236, attach: false, unread: true, body: "결재 문서 유형에 따라 결재선이 자동으로 채워집니다. 상세 변경 내역은 릴리즈 노트를 확인해 주세요." },
  { cat: "경영", title: "4분기 조직개편 사전 안내", author: "경영지원실 배현수", date: "08.22", views: 731, attach: false, unread: false, body: "4분기 조직개편의 방향성과 일정을 사전 공유합니다. 확정안은 9월 말 타운홀에서 안내 예정입니다." },
  { cat: "복지", title: "사내 카페테리아 메뉴 및 운영시간 변경", author: "총무팀 신유리", date: "08.20", views: 189, attach: false, unread: false, body: "9월부터 카페테리아 운영시간이 08:00–19:00로 확대되고 샐러드 코너가 신설됩니다." },
  { cat: "HR", title: "2026년 하반기 승진 심사 일정 공고", author: "인사팀 오세라", date: "08.18", views: 645, attach: true, unread: false, body: "하반기 승진 심사 대상자 명단과 평가 일정을 공고합니다. 이의 신청은 8월 29일까지 접수합니다." },
  { cat: "복지", title: "건강검진 예약 오픈 안내 (9/1~10/31)", author: "총무팀 신유리", date: "08.15", views: 302, attach: true, unread: false, body: "제휴 검진센터 예약이 오픈되었습니다. 만 35세 이상은 종합검진 항목이 자동 포함됩니다." },
  { cat: "경영", title: "2분기 경영실적 공유 및 타운홀 미팅", author: "경영지원실 배현수", date: "08.11", views: 522, attach: false, unread: false, body: "2분기 실적과 하반기 목표를 공유하는 전사 타운홀을 진행합니다. 참석이 어려운 경우 녹화본이 제공됩니다." },
];

/* ------------------------------------------------------------------ */
/*  프로젝트 Task (tasks/{id}) — 칸반 컬럼별                              */
/* ------------------------------------------------------------------ */

export const SEED_BOARD: {
  key: string;
  items: { id: number; tag: string; title: string; who: string; dday: string; done: number; total: number }[];
}[] = [
  {
    key: "todo",
    items: [
      { id: 11, tag: "UI/UX", title: "근태 캘린더 뷰 인터랙션 정의", who: "김세진", dday: "D-3", done: 0, total: 4 },
      { id: 12, tag: "Backend", title: "결재선 자동 지정 룰 엔진 설계", who: "정민준", dday: "D-5", done: 1, total: 6 },
    ],
  },
  {
    key: "doing",
    items: [
      { id: 13, tag: "Backend", title: "출퇴근 기록 API 예외 처리", who: "정민준", dday: "D-Day", done: 2, total: 5 },
      { id: 14, tag: "Frontend", title: "대시보드 위젯 반응형 대응", who: "박서윤", dday: "D-1", done: 3, total: 5 },
      { id: 15, tag: "UI/UX", title: "공지사항 게시판 리디자인", who: "최유나", dday: "D-4", done: 1, total: 3 },
    ],
  },
  {
    key: "review",
    items: [
      { id: 16, tag: "Frontend", title: "조직도 트리 가상 스크롤 적용", who: "이도현", dday: "D+1", done: 4, total: 5 },
      { id: 17, tag: "QA", title: "전자결재 회귀 테스트 시나리오", who: "최유나", dday: "D-2", done: 6, total: 8 },
    ],
  },
  {
    key: "done",
    items: [
      { id: 18, tag: "Backend", title: "주 52시간 집계 배치 개선", who: "정민준", dday: "완료", done: 5, total: 5 },
      { id: 19, tag: "UI/UX", title: "사이드바 다크 테마 토큰 정리", who: "김세진", dday: "완료", done: 3, total: 3 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  전자결재 (approvals/{no}) — pending · drafted · referenced           */
/* ------------------------------------------------------------------ */

export type SeedApprovalRow = {
  no: string; type: string; title: string; author: string; date: string; approver: string; status: string;
};

export const SEED_APPROVAL_ROWS: SeedApprovalRow[][] = [
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

/** 상세가 채워진 결재 문서 (칸반 상세 화면 데모용) */
export const SEED_APPROVAL_DETAIL: Record<
  string,
  {
    line: { kind: string; name: string; role: string; state: string; at: string; done: boolean }[];
    meta: { label: string; value: string }[];
    rows: { date: string; desc: string; amount: number; receipt: string }[];
    comments: { name: string; role: string; at: string; body: string }[];
    reason: string;
  }
> = {
  "EX-2026-0912": {
    line: [
      { kind: "기안", name: "박서윤", role: "사원 · 마케팅팀", state: "기안", at: "09.01 09:12", done: true },
      { kind: "결재", name: "강태오", role: "팀장 · 마케팅팀", state: "승인", at: "09.01 11:40", done: true },
      { kind: "합의", name: "조민아", role: "팀장 · 재무팀", state: "합의 완료", at: "09.02 10:05", done: true },
      { kind: "결재", name: "김세진", role: "과장 · 플랫폼개발팀", state: "결재 대기", at: "", done: false },
      { kind: "참조", name: "배현수", role: "본부장 · 경영지원", state: "참조", at: "", done: false },
    ],
    meta: [
      { label: "문서번호", value: "EX-2026-0912" },
      { label: "기안자", value: "박서윤 사원" },
      { label: "기안부서", value: "마케팅본부 · 마케팅팀" },
      { label: "기안일자", value: "2026.09.01" },
      { label: "보안등급", value: "일반" },
      { label: "보존연한", value: "5년" },
    ],
    rows: [
      { date: "2026.08.21", desc: "팀 워크숍 숙박비 (2실 2박)", amount: 640000, receipt: "첨부" },
      { date: "2026.08.21", desc: "워크숍 식대 (12인)", amount: 384000, receipt: "첨부" },
      { date: "2026.08.22", desc: "이동 차량 렌트 (승합 1대)", amount: 176000, receipt: "전표" },
    ],
    comments: [
      { name: "강태오", role: "팀장 · 마케팅팀", at: "09.01 11:40", body: "워크숍 예산 범위 내 집행 확인했습니다. 승인합니다." },
      { name: "조민아", role: "팀장 · 재무팀", at: "09.02 10:05", body: "차량 렌트 건은 카드 전표로 대체 증빙 처리했습니다. 원본 영수증 확보 시 회계팀으로 전달 부탁드립니다." },
    ],
    reason:
      "3분기 팀 워크숍(8/21–8/22, 강원 고성)에 집행된 숙박비 · 식대 · 이동 차량 렌트 비용의 정산을 요청합니다. 차량 렌트 건은 현장 결제로 영수증 원본 확보가 지연되어 카드 전표로 대체 증빙합니다.",
  },
};

/* ------------------------------------------------------------------ */
/*  회의실 · 자원 예약 (bookings/{id})                                   */
/*  슬롯 = 08:00 시작 30분 단위 (0..23). 예: 10:00 = 4, 13:30 = 11       */
/* ------------------------------------------------------------------ */

export const SEED_BOOKING_DATE = "2026-09-07";

export const SEED_BOOKINGS: {
  id: string; res: string; from: number; to: number; title: string; who: string;
  purpose: string; video: boolean; provider: string;
}[] = [
  { id: "bk-1", res: "mr-a", from: 4, to: 6, title: "플랫폼 주간 스프린트 회의", who: "김세진", purpose: "정기 회의", video: false, provider: "" },
  { id: "bk-2", res: "mr-b", from: 11, to: 13, title: "결재 정책 유관부서 리뷰", who: "정민준", purpose: "정기 회의", video: true, provider: "Google Meet" },
  { id: "bk-3", res: "mr-focus", from: 14, to: 17, title: "신규 입사자 온보딩 멘토링", who: "오세라", purpose: "교육", video: false, provider: "" },
  { id: "bk-4", res: "mr-hall", from: 16, to: 20, title: "2분기 경영실적 타운홀", who: "배현수", purpose: "정기 회의", video: true, provider: "Zoom" },
  { id: "bk-5", res: "car-ioniq", from: 2, to: 8, title: "고객사 방문 (판교)", who: "강태오", purpose: "고객 미팅", video: false, provider: "" },
  { id: "bk-6", res: "proj-epson", from: 16, to: 20, title: "타운홀 빔프로젝터 대여", who: "신유리", purpose: "정기 회의", video: false, provider: "" },
];

/* ------------------------------------------------------------------ */
/*  워크스페이스(회사) 기본 정보 (workspace/main)                         */
/* ------------------------------------------------------------------ */

export const SEED_WORKSPACE = {
  name: "주식회사 넥스트코어",
  bizNo: "214-88-01102",
  ceo: "노정헌",
  address: "서울 강남구 테헤란로 231",
  phone: "02-1588-2200",
  fiscalYearStart: "매년 1월 1일",
};
