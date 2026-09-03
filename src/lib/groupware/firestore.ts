/**
 * CoreFlow 그룹웨어 — Firestore 컬렉션 정의 · 시드 페이로드
 *
 * 컬렉션
 *   orgPeople/{id}      임직원 디렉토리 (id = "0".."13")
 *   notices/{id}        공지사항
 *   tasks/{id}          프로젝트 Task (칸반 카드, colKey 로 컬럼 구분)
 *   approvals/{no}      전자결재 문서 (id = 문서번호)
 *   attendance/{uid}    사용자별 출퇴근 상태 (본인만 읽기/쓰기)
 *   users/{uid}         로그인 사용자 프로필 + gwSettings (기존)
 */
import {
  APPROVAL_ROWS,
  BOARD,
  DETAIL_COMMENTS,
  DETAIL_LINE,
  DETAIL_META,
  DETAIL_ROWS,
  NOTICE_ALL,
  NOTICE_PINNED,
  PEOPLE,
} from "./data";

export const COL = {
  people: "orgPeople",
  notices: "notices",
  tasks: "tasks",
  approvals: "approvals",
  attendance: "attendance",
  users: "users",
} as const;

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
}

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
  date: string;
  approver: string;
  status: string; // Waiting | In Progress | Approved | Rejected
  bucket: "pending" | "drafted" | "referenced";
  order: number;
  /* 상세(선택) */
  line?: { kind: string; name: string; role: string; state: string; at: string; done: boolean }[];
  meta?: { label: string; value: string }[];
  rows?: { date: string; desc: string; amount: number; receipt: string }[];
  comments?: { name: string; role: string; at: string; body: string }[];
  reason?: string;
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

  // 임직원 디렉토리
  PEOPLE.forEach((p) => {
    out.push({ collection: COL.people, id: String(p.id), data: { ...p } });
  });

  // 공지 — 필독 고정 + 일반
  NOTICE_PINNED.forEach((p, i) => {
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
      },
    });
  });
  NOTICE_ALL.forEach((n, i) => {
    out.push({
      collection: COL.notices,
      id: `n-${i}`,
      data: { ...n, pinned: false, order: i },
    });
  });

  // Task — BOARD 를 flat 하게
  BOARD.forEach((col) => {
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
          order: i,
        },
      });
    });
  });

  // 전자결재 — 3개 버킷
  const buckets: ApprovalDoc["bucket"][] = ["pending", "drafted", "referenced"];
  APPROVAL_ROWS.forEach((rows, b) => {
    rows.forEach((r, i) => {
      const data: Record<string, unknown> = {
        ...r,
        bucket: buckets[b],
        order: i,
      };
      if (r.no === "EX-2026-0912") {
        data.line = DETAIL_LINE;
        data.meta = DETAIL_META;
        data.rows = DETAIL_ROWS;
        data.comments = DETAIL_COMMENTS;
        data.reason =
          "3분기 팀 워크숍(8/21–8/22, 강원 고성)에 집행된 숙박비 · 식대 · 이동 차량 렌트 비용의 정산을 요청합니다. 차량 렌트 건은 현장 결제로 영수증 원본 확보가 지연되어 카드 전표로 대체 증빙합니다.";
      } else {
        data.line = [
          { kind: "기안", name: r.author.split(" ")[0], role: "기안자", state: "기안", at: r.date, done: true },
          { kind: "결재", name: r.approver.split(" ")[0], role: "결재자", state: r.status === "Approved" ? "승인" : r.status === "Rejected" ? "반려" : "대기", at: "", done: r.status === "Approved" },
        ];
        data.meta = [
          { label: "문서번호", value: r.no },
          { label: "기안자", value: r.author },
          { label: "기안일자", value: `2026.${r.date.replace(".", ".")}` },
        ];
      }
      out.push({ collection: COL.approvals, id: r.no, data });
    });
  });

  return out;
}
