"use client";

import * as React from "react";
import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { signOut } from "firebase/auth";
import {
  firebaseAuth,
  firebaseDb,
  firebaseStorage,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";
import { clearTwoFactorVerified } from "@/lib/twoFactorSession";
import { generateBackupCodes, hashBackupCode } from "@/lib/totp";
import { notifyJandi, notifySlack } from "@/lib/integrations/notify";
import { createGoogleCalendarEvent } from "@/lib/googleCalendar";
import type { UserDoc } from "@/types/user";
import {
  APPROVAL_ROWS,
  ATT_ROWS,
  BOARD,
  NOTICE_ALL,
  NOTICE_PINNED,
  PEOPLE,
  type Person,
} from "./data";
import {
  ANNUAL_LEAVE_TOTAL,
  COL,
  EVENT_CATEGORIES,
  TASK_COLUMNS,
  buildSeed,
  noticeCommentsPath,
  type ApprovalDoc,
  type AttendanceDoc,
  type BookingDoc,
  type EventDoc,
  type LeaveDoc,
  type NoticeCommentDoc,
  type NoticeDoc,
  type SessionDoc,
  type TaskDoc,
  type WorkspaceDoc,
} from "./firestore";

const two = (n: number) => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ */
/*  현재 로그인 사용자 (프로필 우선, 이메일 앞부분으로 폴백)             */
/* ------------------------------------------------------------------ */

export function useCurrentUser() {
  const { authUser, profile, loading, logout } = useAuthUser();
  const email = profile?.email ?? authUser?.email ?? null;
  const name =
    profile?.name ||
    authUser?.displayName ||
    (email ? email.split("@")[0] : "게스트");
  return {
    name,
    role: profile?.position ?? "",
    team: profile?.departmentId ?? "",
    email,
    initial: name.charAt(0).toUpperCase(),
    isAuthed: !!authUser,
    loading,
    logout,
  };
}

/* ------------------------------------------------------------------ */
/*  제네릭 실시간 컬렉션 훅 (Firestore → 정적 데이터 폴백)               */
/* ------------------------------------------------------------------ */

type Source = "firestore" | "fallback";

function useGwCollection<T>(
  collectionName: string,
  fallback: T[],
  orderField = "order",
): { data: T[]; loading: boolean; source: Source } {
  const [state, setState] = React.useState<{
    data: T[];
    loading: boolean;
    source: Source;
  }>({ data: fallback, loading: isFirebaseConfigured, source: "fallback" });

  React.useEffect(() => {
    if (!isFirebaseConfigured) return;
    const q = query(
      collection(firebaseDb(), collectionName),
      orderBy(orderField),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setState({ data: fallback, loading: false, source: "fallback" });
          return;
        }
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
          loading: false,
          source: "firestore",
        });
      },
      () => setState({ data: fallback, loading: false, source: "fallback" }),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, orderField]);

  return state;
}

/* ------------------------------------------------------------------ */
/*  공지사항                                                            */
/* ------------------------------------------------------------------ */

const NOTICE_FALLBACK: NoticeDoc[] = [
  ...NOTICE_PINNED.map((p, i) => ({
    id: `pinned-${i}`,
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
  })),
  ...NOTICE_ALL.map((n, i) => ({ ...n, id: `n-${i}`, pinned: false, order: i })),
];

export function useNotices() {
  const state = useGwCollection<NoticeDoc>(COL.notices, NOTICE_FALLBACK);
  const me = useCurrentUser();

  const addNotice = React.useCallback(
    async (input: { cat: string; title: string; body: string; pinned: boolean }) => {
      if (!isFirebaseConfigured) return;
      const id = String(Date.now());
      const now = new Date();
      const date = `${two(now.getMonth() + 1)}.${two(now.getDate())}`;
      const author = me.role ? `${me.name} ${me.role}` : me.name;
      await setDoc(doc(firebaseDb(), COL.notices, id), {
        cat: input.cat,
        title: input.title,
        body: input.body,
        author,
        date,
        views: 0,
        attach: false,
        unread: true,
        pinned: input.pinned,
        comments: 0,
        order: -now.getTime(), // 최신 글이 위로 오도록
      });
      notifySlack(
        `${input.pinned ? "📌 " : ""}[공지] ${input.title}\n${author} · ${input.body.slice(0, 140)}`,
        input.title,
      ).catch(() => {});
    },
    [me.name, me.role],
  );

  return { ...state, addNotice };
}

export function useNoticeDoc(id: string) {
  const state = useGwCollection<NoticeDoc>(COL.notices, NOTICE_FALLBACK);
  const doc_ = state.data.find((n) => n.id === id) ?? null;

  React.useEffect(() => {
    if (!isFirebaseConfigured || !id) return;
    updateDoc(doc(firebaseDb(), COL.notices, id), {
      views: increment(1),
      unread: false,
    }).catch(() => {});
  }, [id]);

  return { notice: doc_, loading: state.loading };
}

/** 공지 댓글 — notices/{id}/comments 서브컬렉션 */
export function useNoticeComments(noticeId: string) {
  const me = useCurrentUser();
  const { authUser } = useAuthUser();
  const [data, setData] = React.useState<NoticeCommentDoc[]>([]);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);
  const [added, setAdded] = React.useState<NoticeCommentDoc[]>([]);

  React.useEffect(() => {
    if (!isFirebaseConfigured || !noticeId) return;
    const q = query(
      collection(firebaseDb(), noticeCommentsPath(noticeId)),
      orderBy("order"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticeCommentDoc),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [noticeId]);

  const comments = React.useMemo(() => {
    const extra = added.filter((a) => !data.some((d) => d.id === a.id));
    return [...data, ...extra].sort((a, b) => a.order - b.order);
  }, [data, added]);

  const addComment = React.useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text) return;
      const id = String(Date.now());
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const at = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(
        now.getDate(),
      )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const payload: Omit<NoticeCommentDoc, "id"> = {
        uid: authUser?.uid ?? "local",
        author: me.name,
        role: me.role,
        body: text,
        at,
        order: now.getTime(),
      };
      setAdded((p) => [...p, { id, ...payload }]);
      if (isFirebaseConfigured) {
        await setDoc(
          doc(firebaseDb(), noticeCommentsPath(noticeId), id),
          payload,
        );
        await updateDoc(doc(firebaseDb(), COL.notices, noticeId), {
          comments: increment(1),
        }).catch(() => {});
      }
    },
    [noticeId, me.name, me.role, authUser?.uid],
  );

  return { comments, loading, addComment };
}

/* ------------------------------------------------------------------ */
/*  Task                                                               */
/* ------------------------------------------------------------------ */

const TASK_FALLBACK: TaskDoc[] = BOARD.flatMap((col) =>
  col.items.map((t, i) => ({
    id: String(t.id),
    colKey: col.key,
    tag: t.tag,
    title: t.title,
    who: t.who,
    dday: t.dday,
    done: t.done,
    total: t.total,
    order: i,
  })),
);

export function useTasks() {
  const state = useGwCollection<TaskDoc>(COL.tasks, TASK_FALLBACK);
  const me = useCurrentUser();
  // 낙관적 오버레이 (Firebase 미설정 시엔 이게 유일한 저장소)
  const [overlay, setOverlay] = React.useState<Record<string, Partial<TaskDoc>>>(
    {},
  );
  const [added, setAdded] = React.useState<TaskDoc[]>([]);

  const data = React.useMemo(() => {
    const base = state.data.map((t) =>
      overlay[t.id] ? { ...t, ...overlay[t.id] } : t,
    );
    const extra = added
      .filter((a) => !state.data.some((t) => t.id === a.id))
      .map((a) => (overlay[a.id] ? { ...a, ...overlay[a.id] } : a));
    return [...base, ...extra];
  }, [state.data, overlay, added]);

  const addTask = React.useCallback(
    async (colKey: string, title: string) => {
      const id = String(Date.now());
      const task: TaskDoc = {
        id,
        colKey,
        tag: "기획",
        title,
        who: me.name,
        dday: "D-7",
        done: 0,
        total: 3,
        order: 999,
      };
      setAdded((p) => [...p, task]);
      if (isFirebaseConfigured) {
        await setDoc(doc(firebaseDb(), COL.tasks, id), {
          colKey: task.colKey,
          tag: task.tag,
          title: task.title,
          who: task.who,
          dday: task.dday,
          done: task.done,
          total: task.total,
          order: task.order,
        });
      }
    },
    [me.name],
  );

  const toggleDone = React.useCallback(async (t: TaskDoc) => {
    const nextDone = t.done === t.total ? 0 : t.total;
    setOverlay((p) => ({ ...p, [t.id]: { ...p[t.id], done: nextDone } }));
    if (isFirebaseConfigured) {
      await updateDoc(doc(firebaseDb(), COL.tasks, t.id), { done: nextDone });
    }
  }, []);

  /** 칸반 카드 클릭 시 다음 단계 컬럼으로 이동 (마지막 → 처음) */
  const moveTask = React.useCallback(async (t: TaskDoc) => {
    const keys = TASK_COLUMNS.map((c) => c.key);
    const nextKey = keys[(keys.indexOf(t.colKey) + 1) % keys.length];
    const lastCol = keys[keys.length - 1];
    const patch: Partial<TaskDoc> =
      nextKey === lastCol
        ? { colKey: nextKey, done: t.total }
        : { colKey: nextKey };
    setOverlay((p) => ({ ...p, [t.id]: { ...p[t.id], ...patch } }));
    if (isFirebaseConfigured) {
      await updateDoc(doc(firebaseDb(), COL.tasks, t.id), patch);
    }
  }, []);

  return { ...state, data, addTask, toggleDone, moveTask };
}

/* ------------------------------------------------------------------ */
/*  전자결재                                                            */
/* ------------------------------------------------------------------ */

const APPROVAL_FALLBACK: ApprovalDoc[] = APPROVAL_ROWS.flatMap((rows, b) =>
  rows.map((r, i) => ({
    ...r,
    bucket: (["pending", "drafted", "referenced"] as const)[b],
    order: i,
  })),
);

export type NewApproval = {
  no: string;
  type: string;
  title: string;
  approver: string;
  status: string; // Waiting | In Progress | ...
  bucket: ApprovalDoc["bucket"];
  line?: ApprovalDoc["line"];
  meta?: ApprovalDoc["meta"];
  rows?: ApprovalDoc["rows"];
  attachments?: ApprovalDoc["attachments"];
  reason?: string;
};

export function useApprovals() {
  const state = useGwCollection<ApprovalDoc>(COL.approvals, APPROVAL_FALLBACK);
  const me = useCurrentUser();
  // 낙관적 추가 (Firebase 미설정 시엔 이게 유일한 저장소)
  const [added, setAdded] = React.useState<ApprovalDoc[]>([]);

  const data = React.useMemo(() => {
    const extra = added.filter((a) => !state.data.some((d) => d.no === a.no));
    return [...state.data, ...extra];
  }, [state.data, added]);

  const createApproval = React.useCallback(
    async (input: NewApproval) => {
      const now = new Date();
      const date = `${two(now.getMonth() + 1)}.${two(now.getDate())}`;
      const author = me.role ? `${me.name} ${me.role}` : me.name;
      const payload: Omit<ApprovalDoc, "no"> = {
        type: input.type,
        title: input.title,
        author,
        date,
        approver: input.approver,
        status: input.status,
        bucket: input.bucket,
        order: -now.getTime(), // 최신 문서가 위로
        ...(input.line ? { line: input.line } : {}),
        ...(input.meta ? { meta: input.meta } : {}),
        ...(input.rows ? { rows: input.rows } : {}),
        ...(input.attachments && input.attachments.length
          ? { attachments: input.attachments }
          : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      };
      setAdded((p) => [...p, { no: input.no, ...payload }]);
      if (isFirebaseConfigured) {
        await setDoc(doc(firebaseDb(), COL.approvals, input.no), payload);
      }
      notifySlack(
        `[결재 상신] ${input.title} (${input.no})\n기안자 ${author} · 결재자 ${input.approver}`,
        input.title,
      ).catch(() => {});
      return input.no;
    },
    [me.name, me.role],
  );

  return { ...state, data, createApproval };
}

export function useApprovalDoc(no: string) {
  const me = useCurrentUser();
  // undefined = 아직 로드 안 됨, null = 문서 없음
  const [remote, setRemote] = React.useState<ApprovalDoc | null | undefined>(
    () =>
      isFirebaseConfigured
        ? undefined
        : (APPROVAL_FALLBACK.find((a) => a.no === no) ?? null),
  );

  React.useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onSnapshot(
      doc(firebaseDb(), COL.approvals, no),
      (snap) =>
        setRemote(
          snap.exists()
            ? ({ no: snap.id, ...snap.data() } as ApprovalDoc)
            : null,
        ),
      () => setRemote(null),
    );
    return () => {
      unsub();
      setRemote(undefined);
    };
  }, [no]);

  const fallback = APPROVAL_FALLBACK.find((a) => a.no === no) ?? null;
  const document =
    remote === undefined ? (isFirebaseConfigured ? null : fallback) : (remote ?? fallback);
  const loading = isFirebaseConfigured && remote === undefined;

  const setStatus = React.useCallback(
    async (status: string) => {
      let title = "";
      setRemote((r) => {
        title = r?.title ?? "";
        return r ? { ...r, status } : r;
      });
      if (isFirebaseConfigured) {
        await updateDoc(doc(firebaseDb(), COL.approvals, no), { status });
      }
      const label =
        status === "Approved" ? "승인" : status === "Rejected" ? "반려" : status;
      notifySlack(
        `[결재 ${label}] ${title || no} (${no}) · ${me.name}`,
        title || no,
      ).catch(() => {});
    },
    [no, me.name],
  );

  /** 결재 의견(코멘트) 추가 — comments 배열에 append */
  const addComment = React.useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text) return;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const comment = {
        name: me.name,
        role: me.role || "결재자",
        at: `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
        body: text,
      };
      setRemote((r) =>
        r ? { ...r, comments: [...(r.comments ?? []), comment] } : r,
      );
      if (isFirebaseConfigured) {
        await updateDoc(doc(firebaseDb(), COL.approvals, no), {
          comments: arrayUnion(comment),
        });
      }
    },
    [no, me.name, me.role],
  );

  return { doc: document, loading, setStatus, addComment };
}

/* ------------------------------------------------------------------ */
/*  캘린더 일정 — events/{id}                                           */
/* ------------------------------------------------------------------ */

export interface EventInput {
  title: string;
  date: string; // yyyy-mm-dd
  end?: string; // yyyy-mm-dd
  start: string; // HH:MM
  finish: string; // HH:MM
  allDay: boolean;
  category: string;
  location: string;
  memo: string;
}

const eventColor = (category: string) =>
  EVENT_CATEGORIES.find((c) => c.key === category)?.color ?? "#64748b";

const eventOrder = (date: string, start: string) =>
  Number(date.replace(/-/g, "")) * 10000 +
  Number((start || "0000").replace(":", ""));

export function useEvents() {
  const { authUser } = useAuthUser();
  const me = useCurrentUser();
  const uid = authUser?.uid ?? "local";
  const state = useGwCollection<EventDoc>(COL.events, []);
  const [added, setAdded] = React.useState<EventDoc[]>([]);
  const [patches, setPatches] = React.useState<
    Record<string, Partial<EventDoc> | null>
  >({});

  const data = React.useMemo(() => {
    const base = [
      ...state.data,
      ...added.filter((a) => !state.data.some((e) => e.id === a.id)),
    ];
    return base
      .map((e) => {
        const p = patches[e.id];
        if (p === null) return null;
        return p ? { ...e, ...p } : e;
      })
      .filter((e): e is EventDoc => e !== null)
      .sort((a, b) => a.order - b.order);
  }, [state.data, added, patches]);

  const toPayload = React.useCallback(
    (input: EventInput): Omit<EventDoc, "id"> => ({
      title: input.title.trim() || "새 일정",
      date: input.date,
      end: input.end || input.date,
      start: input.allDay ? "" : input.start,
      finish: input.allDay ? "" : input.finish,
      allDay: input.allDay,
      category: input.category,
      location: input.location.trim(),
      memo: input.memo.trim(),
      owner: uid,
      ownerName: me.name,
      color: eventColor(input.category),
      order: eventOrder(input.date, input.allDay ? "" : input.start),
    }),
    [uid, me.name],
  );

  const addEvent = React.useCallback(
    async (input: EventInput) => {
      const id = String(Date.now());
      const payload = toPayload(input);
      setAdded((p) => [...p, { id, ...payload }]);
      if (isFirebaseConfigured && authUser) {
        await setDoc(doc(firebaseDb(), COL.events, id), payload);
      }
      // 이 브라우저에서 Google Calendar 가 연동돼 있으면 내 캘린더에도 복사합니다.
      createGoogleCalendarEvent(input).catch(() => {});
      return id;
    },
    [toPayload, authUser],
  );

  const saveEvent = React.useCallback(
    async (id: string, input: EventInput) => {
      const payload = toPayload(input);
      setPatches((p) => ({ ...p, [id]: payload }));
      if (isFirebaseConfigured) {
        await updateDoc(doc(firebaseDb(), COL.events, id), payload);
      }
    },
    [toPayload],
  );

  const removeEvent = React.useCallback(async (id: string) => {
    setPatches((p) => ({ ...p, [id]: null }));
    if (isFirebaseConfigured) {
      await deleteDoc(doc(firebaseDb(), COL.events, id));
    }
  }, []);

  return {
    data,
    loading: state.loading,
    myUid: uid,
    addEvent,
    saveEvent,
    removeEvent,
  };
}

/* ------------------------------------------------------------------ */
/*  회의실 · 자원 예약                                                  */
/* ------------------------------------------------------------------ */

export function useBookings() {
  const state = useGwCollection<BookingDoc>(COL.bookings, []);
  const me = useCurrentUser();
  const [added, setAdded] = React.useState<BookingDoc[]>([]);

  const data = React.useMemo(() => {
    const extra = added.filter((a) => !state.data.some((b) => b.id === a.id));
    return [...state.data, ...extra];
  }, [state.data, added]);

  const addBooking = React.useCallback(
    async (input: {
      res: string;
      from: number;
      to: number;
      title: string;
      purpose?: string;
      attendees?: number[];
      video?: boolean;
      provider?: string;
    }) => {
      const id = String(Date.now());
      const now = new Date();
      const payload: Omit<BookingDoc, "id"> = {
        res: input.res,
        from: input.from,
        to: input.to,
        title: input.title,
        who: me.name,
        date: now.toISOString().slice(0, 10),
        purpose: input.purpose ?? "",
        attendees: input.attendees ?? [],
        video: input.video ?? false,
        provider: input.provider ?? "",
        order: input.from,
      };
      setAdded((p) => [...p, { id, ...payload }]);
      if (isFirebaseConfigured) {
        await setDoc(doc(firebaseDb(), COL.bookings, id), payload);
      }
      return id;
    },
    [me.name],
  );

  const removeBooking = React.useCallback(async (id: string) => {
    setAdded((p) => p.filter((b) => b.id !== id));
    if (isFirebaseConfigured) {
      await deleteDoc(doc(firebaseDb(), COL.bookings, id));
    }
  }, []);

  return { ...state, data, addBooking, removeBooking };
}

/* ------------------------------------------------------------------ */
/*  조직도                                                              */
/* ------------------------------------------------------------------ */

export function useOrgPeople() {
  const { data, loading, source } = useGwCollection<Person & { id: number }>(
    COL.people,
    PEOPLE,
    "id",
  );
  // Firestore 에서 온 경우 id 가 문자열일 수 있어 정규화
  const people = React.useMemo(
    () => data.map((p) => ({ ...p, id: Number(p.id), tags: p.tags ?? [] })),
    [data],
  );

  const addPerson = React.useCallback(
    async (input: Omit<Person, "id">) => {
      if (!isFirebaseConfigured) return;
      const nextId = people.length
        ? Math.max(...people.map((p) => p.id)) + 1
        : 1;
      await setDoc(doc(firebaseDb(), COL.people, String(nextId)), {
        id: nextId,
        ...input,
      });
      return nextId;
    },
    [people],
  );

  const updatePerson = React.useCallback(
    async (id: number, patch: Partial<Omit<Person, "id">>) => {
      if (!isFirebaseConfigured) return;
      await updateDoc(doc(firebaseDb(), COL.people, String(id)), patch);
    },
    [],
  );

  const removePerson = React.useCallback(async (id: number) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(firebaseDb(), COL.people, String(id)));
  }, []);

  return { people, loading, source, addPerson, updatePerson, removePerson };
}

/* ------------------------------------------------------------------ */
/*  출퇴근 (attendance/{uid})                                           */
/* ------------------------------------------------------------------ */

const ATT_DEFAULT = {
  working: false,
  inAt: "--:--",
  outAt: "--:--",
  weekWorked: 0,
  history: ATT_ROWS,
};

export function useAttendance() {
  const { authUser } = useAuthUser();
  const uid = authUser?.uid;
  const [remote, setRemote] = React.useState<AttendanceDoc | null>(null);
  const [local, setLocal] = React.useState(ATT_DEFAULT);

  React.useEffect(() => {
    if (!isFirebaseConfigured || !uid) return;
    const unsub = onSnapshot(
      doc(firebaseDb(), COL.attendance, uid),
      (snap) => {
        setRemote(
          snap.exists() ? ({ uid, ...snap.data() } as AttendanceDoc) : null,
        );
      },
      () => setRemote(null),
    );
    return () => {
      unsub();
      setRemote(null);
    };
  }, [uid]);

  const cur = remote ?? { ...ATT_DEFAULT, ...local };

  const write = React.useCallback(
    async (patch: Partial<AttendanceDoc>) => {
      setLocal((p) => ({ ...p, ...patch }));
      if (isFirebaseConfigured && uid) {
        await setDoc(
          doc(firebaseDb(), COL.attendance, uid),
          {
            ...patch,
            date: new Date().toISOString().slice(0, 10),
          },
          { merge: true },
        );
      }
    },
    [uid],
  );

  const checkIn = React.useCallback(() => {
    const d = new Date();
    return write({
      working: true,
      inAt: `${two(d.getHours())}:${two(d.getMinutes())}`,
      outAt: "--:--",
    });
  }, [write]);

  const checkOut = React.useCallback(() => {
    const d = new Date();
    return write({
      working: false,
      outAt: `${two(d.getHours())}:${two(d.getMinutes())}`,
    });
  }, [write]);

  return {
    working: cur.working,
    inAt: cur.inAt,
    outAt: cur.outAt,
    weekWorked: cur.weekWorked ?? 0,
    history: cur.history ?? ATT_ROWS,
    source: remote ? ("firestore" as const) : ("fallback" as const),
    checkIn,
    checkOut,
  };
}

/* ------------------------------------------------------------------ */
/*  휴가 / 초과근무 신청 (leaves/{id})                                   */
/* ------------------------------------------------------------------ */

const LEAVE_TYPES_COUNTED = ["연차", "반차"];

export function useLeaves() {
  const { authUser } = useAuthUser();
  const me = useCurrentUser();
  const uid = authUser?.uid;
  const [remote, setRemote] = React.useState<LeaveDoc[]>([]);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);
  const [added, setAdded] = React.useState<LeaveDoc[]>([]);

  React.useEffect(() => {
    if (!isFirebaseConfigured || !uid) return;
    const q = query(collection(firebaseDb(), COL.leaves), where("uid", "==", uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRemote(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeaveDoc));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  const data = React.useMemo(() => {
    const extra = added.filter((a) => !remote.some((r) => r.id === a.id));
    return [...remote, ...extra].sort((a, b) => b.order - a.order);
  }, [remote, added]);

  const usedDays = data
    .filter((l) => LEAVE_TYPES_COUNTED.includes(l.kind) && l.status !== "반려")
    .reduce((sum, l) => sum + (l.days || 0), 0);
  const balance = {
    total: ANNUAL_LEAVE_TOTAL,
    used: usedDays,
    remaining: Math.max(0, ANNUAL_LEAVE_TOTAL - usedDays),
  };

  const addLeave = React.useCallback(
    async (input: {
      kind: string;
      start: string;
      end: string;
      days: number;
      hours?: number;
      reason: string;
    }) => {
      const id = String(Date.now());
      const now = new Date();
      const payload: Omit<LeaveDoc, "id"> = {
        uid: uid ?? "local",
        who: me.name,
        kind: input.kind,
        start: input.start,
        end: input.end,
        days: input.days,
        hours: input.hours ?? 0,
        reason: input.reason,
        status: "대기",
        order: now.getTime(),
      };
      setAdded((p) => [...p, { id, ...payload }]);
      if (isFirebaseConfigured && uid) {
        await setDoc(doc(firebaseDb(), COL.leaves, id), payload);
      }
      notifyJandi(
        `[근태] ${me.name}님이 ${input.kind}를 신청했습니다. (${input.start} ~ ${input.end})\n사유: ${input.reason}`,
        `${input.kind} 신청`,
      ).catch(() => {});
      return id;
    },
    [uid, me.name],
  );

  const cancelLeave = React.useCallback(async (id: string) => {
    setAdded((p) => p.filter((l) => l.id !== id));
    if (isFirebaseConfigured) {
      await deleteDoc(doc(firebaseDb(), COL.leaves, id));
    }
  }, []);

  return { data, loading, balance, addLeave, cancelLeave };
}

/**
 * 결재자(관리자) 관점의 연차·근태 승인 대기 목록.
 * 관리자만 `status == "대기"` 전체 쿼리 가능 (leaves 규칙: isAdmin).
 */
export function usePendingLeaves() {
  const { profile } = useAuthUser();
  const isAdmin =
    profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const [data, setData] = React.useState<LeaveDoc[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!isFirebaseConfigured || !isAdmin) return;
    const q = query(
      collection(firebaseDb(), COL.leaves),
      where("status", "==", "대기"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as LeaveDoc)
            .sort((a, b) => b.order - a.order),
        );
        setLoaded(true);
      },
      () => setLoaded(true),
    );
    return unsub;
  }, [isAdmin]);

  const decide = React.useCallback(
    async (id: string, status: "승인" | "반려") => {
      let target: LeaveDoc | undefined;
      setData((p) => {
        target = p.find((l) => l.id === id);
        return p.filter((l) => l.id !== id);
      });
      if (isFirebaseConfigured) {
        await updateDoc(doc(firebaseDb(), COL.leaves, id), { status });
      }
      if (target) {
        notifyJandi(
          `[근태] ${target.who}님의 ${target.kind} 신청이 ${status}되었습니다. (${target.start} ~ ${target.end})`,
          `${target.kind} ${status}`,
        ).catch(() => {});
      }
    },
    [],
  );

  return {
    isAdmin,
    data: isAdmin ? data : [],
    loading: isAdmin && isFirebaseConfigured && !loaded,
    approve: (id: string) => decide(id, "승인"),
    reject: (id: string) => decide(id, "반려"),
  };
}

/* ------------------------------------------------------------------ */
/*  개인 설정 (users/{uid}.gwSettings)                                  */
/* ------------------------------------------------------------------ */

export function useGwSettings() {
  const { authUser, profile } = useAuthUser();

  const save = React.useCallback(
    async (patch: Record<string, unknown>) => {
      if (!isFirebaseConfigured || !authUser) return;
      await updateDoc(doc(firebaseDb(), COL.users, authUser.uid), {
        ...patch,
        updatedAt: new Date(),
      });
    },
    [authUser],
  );

  /** 프로필/서명 이미지를 Storage(users/{uid})에 올리고 users 문서에 URL 저장 */
  const uploadImage = React.useCallback(
    async (kind: "profile" | "signature", file: File) => {
      if (!isFirebaseConfigured || !authUser) return null;
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const snap = await uploadBytes(
        storageRef(firebaseStorage(), `users/${authUser.uid}/${kind}.${ext}`),
        file,
        { contentType: file.type || "image/png", customMetadata: { kind } },
      );
      const url = await getDownloadURL(snap.ref);
      const field = kind === "profile" ? "profileImageUrl" : "signatureUrl";
      await updateDoc(doc(firebaseDb(), COL.users, authUser.uid), {
        [field]: url,
        updatedAt: new Date(),
      });
      return url;
    },
    [authUser],
  );

  const clearImage = React.useCallback(
    async (kind: "profile" | "signature") => {
      if (!isFirebaseConfigured || !authUser) return;
      const field = kind === "profile" ? "profileImageUrl" : "signatureUrl";
      await updateDoc(doc(firebaseDb(), COL.users, authUser.uid), {
        [field]: null,
        updatedAt: new Date(),
      });
    },
    [authUser],
  );

  return {
    profile,
    canSave: !!authUser && !!profile && isFirebaseConfigured,
    save,
    uploadImage,
    clearImage,
  };
}

/* ------------------------------------------------------------------ */
/*  2FA (TOTP) 등록 · 해제 · 백업 코드                                   */
/* ------------------------------------------------------------------ */

export function useTwoFactor() {
  const { authUser, profile } = useAuthUser();
  const gw = profile?.gwSettings;
  const secret = gw?.twoFASecret ?? null;
  const backupHashes = gw?.twoFABackupCodeHashes ?? [];
  const backupCount = backupHashes.length;
  const enabled = !!gw?.twoFA && !!secret;

  /** QR 스캔 후 코드 확인까지 끝난 시크릿을 등록하고 백업 코드를 발급합니다. */
  const enroll = React.useCallback(
    async (secretToSave: string, backupCodes: string[]) => {
      if (!isFirebaseConfigured || !authUser) return;
      const hashes = await Promise.all(backupCodes.map(hashBackupCode));
      await updateDoc(doc(firebaseDb(), COL.users, authUser.uid), {
        "gwSettings.twoFA": true,
        "gwSettings.twoFASecret": secretToSave,
        "gwSettings.twoFABackupCodeHashes": hashes,
        updatedAt: new Date(),
      });
    },
    [authUser],
  );

  const disable = React.useCallback(async () => {
    if (!isFirebaseConfigured || !authUser) return;
    await updateDoc(doc(firebaseDb(), COL.users, authUser.uid), {
      "gwSettings.twoFA": false,
      "gwSettings.twoFASecret": deleteField(),
      "gwSettings.twoFABackupCodeHashes": deleteField(),
      updatedAt: new Date(),
    });
    clearTwoFactorVerified(authUser.uid);
  }, [authUser]);

  /** 기존 백업 코드를 모두 폐기하고 새 8개를 발급합니다. */
  const regenerateBackupCodes = React.useCallback(async (): Promise<
    string[] | null
  > => {
    if (!isFirebaseConfigured || !authUser || !secret) return null;
    const codes = generateBackupCodes();
    const hashes = await Promise.all(codes.map(hashBackupCode));
    await updateDoc(doc(firebaseDb(), COL.users, authUser.uid), {
      "gwSettings.twoFABackupCodeHashes": hashes,
      updatedAt: new Date(),
    });
    return codes;
  }, [authUser, secret]);

  return {
    enabled,
    secret,
    backupCount,
    backupHashes,
    enroll,
    disable,
    regenerateBackupCodes,
  };
}

/* ------------------------------------------------------------------ */
/*  접속 기기(브라우저) 세션 추적 — sessions/{sessionId}                  */
/* ------------------------------------------------------------------ */

const HEARTBEAT_MS = 5 * 60 * 1000; // 5분마다 lastActive 갱신

function readSessionId(uid: string): string {
  const key = `cf-session-id:${uid}`;
  try {
    let id = window.localStorage.getItem(key);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `s-${Date.now()}`;
  }
}

/** 이 기기(브라우저+계정)가 세션ID를 처음 발급받은 시각 — 하트비트가
 *  매번 getDoc 없이 setDoc(merge) 만으로 생성/갱신할 수 있도록 createdAt을
 *  Firestore 조회가 아니라 localStorage 에서 고정값으로 가져옵니다. */
function readSessionCreatedAt(uid: string): number {
  const key = `cf-session-created:${uid}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return Number(raw);
    const now = Date.now();
    window.localStorage.setItem(key, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function forgetSessionId(uid: string) {
  try {
    window.localStorage.removeItem(`cf-session-id:${uid}`);
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) — 무시
  }
}

/** User-Agent 로 기기/브라우저 이름과 아이콘 키를 대략 유추 */
export function parseDevice(ua: string): { label: string; icon: string } {
  const isTablet = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = !isTablet && /Mobi|Android|iPhone/i.test(ua);
  const os = /Mac OS X/i.test(ua)
    ? "Mac"
    : /Windows/i.test(ua)
      ? "Windows"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/i.test(ua)
          ? "iOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "알 수 없는 기기";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "브라우저";
  const icon = isTablet ? "Tablet" : isMobile ? "Smartphone" : os === "Mac" ? "Laptop" : "Monitor";
  return { label: `${os} · ${browser}`, icon };
}

/**
 * 실제 접속 기기 목록. 계정+브라우저 조합마다 localStorage 에 세션ID를
 * 영구 발급해 같은 브라우저로 재접속하면 같은 문서를 이어서 갱신합니다.
 * 다른 기기(같은 계정)에서 세션을 삭제하면, 그 기기가 앱을 열어둔 상태일
 * 경우 실시간으로 감지해 스스로 로그아웃합니다(서버 없이 클라이언트만으로
 * 가능한 강제 로그아웃 — 그 기기가 오프라인이면 다음 접속 시에만 반영).
 */
export function useSessions() {
  const { authUser } = useAuthUser();
  const uid = authUser?.uid ?? null;
  const [data, setData] = React.useState<SessionDoc[]>([]);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);
  const revokedRef = React.useRef(false);

  const mySessionId = React.useMemo(() => {
    if (!uid || typeof window === "undefined") return null;
    return readSessionId(uid);
  }, [uid]);

  // 하트비트: 내 기기의 세션 문서를 생성/갱신
  React.useEffect(() => {
    if (!isFirebaseConfigured || !uid || !mySessionId) return;
    revokedRef.current = false;
    const ref = doc(firebaseDb(), COL.sessions, mySessionId);

    const beat = async () => {
      if (revokedRef.current) return;
      const { label, icon } = parseDevice(navigator.userAgent);
      try {
        // 문서 존재 여부를 매번 getDoc 으로 확인할 필요 없이, merge:true 로
        // 한 번의 쓰기에서 생성/갱신을 모두 처리합니다.
        await setDoc(
          ref,
          {
            uid,
            device: label,
            icon,
            userAgent: navigator.userAgent,
            createdAt: readSessionCreatedAt(uid),
            lastActive: Date.now(),
          },
          { merge: true },
        );
      } catch {
        // 권한 오류(다른 계정이 쓰던 세션ID 충돌 등) — 조용히 무시
      }
    };

    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [uid, mySessionId]);

  // 내 세션 문서 자체를 구독 — 다른 기기가 삭제하면 즉시 로그아웃
  React.useEffect(() => {
    if (!isFirebaseConfigured || !uid || !mySessionId) return;
    let seen = false;
    const unsub = onSnapshot(
      doc(firebaseDb(), COL.sessions, mySessionId),
      (snap) => {
        if (snap.exists()) {
          seen = true;
          return;
        }
        if (seen && !revokedRef.current) {
          revokedRef.current = true;
          forgetSessionId(uid);
          signOut(firebaseAuth()).catch(() => {});
        }
      },
    );
    return unsub;
  }, [uid, mySessionId]);

  // 내 계정에 속한 전체 기기 목록
  React.useEffect(() => {
    if (!isFirebaseConfigured || !uid) return;
    const q = query(collection(firebaseDb(), COL.sessions), where("uid", "==", uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as SessionDoc)
            .sort((a, b) => b.lastActive - a.lastActive),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  const removeSession = React.useCallback(async (id: string) => {
    setData((p) => p.filter((s) => s.id !== id));
    if (isFirebaseConfigured) {
      await deleteDoc(doc(firebaseDb(), COL.sessions, id));
    }
  }, []);

  return { data, loading, mySessionId, removeSession };
}

/* ------------------------------------------------------------------ */
/*  승인 대기 계정 (users, status == PENDING) — 관리자 전용               */
/* ------------------------------------------------------------------ */

export function usePendingUsers() {
  const [data, setData] = React.useState<UserDoc[]>([]);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);

  React.useEffect(() => {
    if (!isFirebaseConfigured) return;
    const q = query(
      collection(firebaseDb(), COL.users),
      where("status", "==", "PENDING"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserDoc));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const approve = React.useCallback(async (uid: string) => {
    setData((p) => p.filter((u) => u.uid !== uid));
    await updateDoc(doc(firebaseDb(), COL.users, uid), {
      status: "ACTIVE",
      updatedAt: new Date(),
    });
  }, []);

  const reject = React.useCallback(async (uid: string) => {
    setData((p) => p.filter((u) => u.uid !== uid));
    await deleteDoc(doc(firebaseDb(), COL.users, uid));
  }, []);

  return { data, loading, approve, reject };
}

/* ------------------------------------------------------------------ */
/*  워크스페이스(회사) 기본 정보 — 관리자만 쓰기                          */
/* ------------------------------------------------------------------ */

/** {"a.b.c": v} → {a: {b: {c: v}}} — updateDoc 이 실패할 때(문서 없음)의 setDoc 폴백용 */
function expandDotPaths(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const parts = key.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      const next = cur[seg];
      cur[seg] = typeof next === "object" && next !== null ? next : {};
      cur = cur[seg] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}

const WORKSPACE_DEFAULT: WorkspaceDoc = {
  name: "",
  bizNo: "",
  ceo: "",
  address: "",
  phone: "",
  fiscalYearStart: "",
};

export function useWorkspace() {
  const [data, setData] = React.useState<WorkspaceDoc>(WORKSPACE_DEFAULT);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);

  React.useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onSnapshot(
      doc(firebaseDb(), COL.workspace, "main"),
      (snap) => {
        setData(
          snap.exists()
            ? { ...WORKSPACE_DEFAULT, ...(snap.data() as Partial<WorkspaceDoc>) }
            : WORKSPACE_DEFAULT,
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  /** `Partial<WorkspaceDoc>` 전체 교체 패치 또는 "integrations.slack" 같은
   *  점(dot) 경로 부분 패치를 모두 받습니다.
   *
   *  dot 경로는 `updateDoc` 으로 써야 실제로 중첩 필드에 반영됩니다 —
   *  `setDoc(..., {merge:true})` 는 점(.)이 든 문자열 키를 경로로 풀어주지
   *  않고 "integrations.slack" 이라는 글자 그대로의 최상위 필드로 저장해
   *  버립니다. 문서가 아직 없을 때만(첫 저장, 시드 전) 없는 문서에
   *  updateDoc 이 실패하므로 dot 경로를 중첩 객체로 펼쳐 setDoc 으로
   *  생성합니다. */
  const save = React.useCallback(
    async (patch: Partial<WorkspaceDoc> | Record<string, unknown>) => {
      if (!isFirebaseConfigured) return;
      const ref = doc(firebaseDb(), COL.workspace, "main");
      try {
        await updateDoc(ref, { ...patch, updatedAt: new Date() });
      } catch {
        await setDoc(
          ref,
          { ...expandDotPaths(patch), updatedAt: new Date() },
          { merge: true },
        );
      }
    },
    [],
  );

  return { data, loading, save };
}

/* ------------------------------------------------------------------ */
/*  알림 센터 — 전용 컬렉션 없이 결재·공지·근태에서 파생                  */
/* ------------------------------------------------------------------ */

export interface Notification {
  id: string;
  cat: "결재" | "공지" | "근태";
  title: string;
  desc: string;
  time: string;
  to: string;
  icon: string;
}

export function useNotifications(): Notification[] {
  const { data: approvals } = useApprovals();
  const { data: notices } = useNotices();
  const { data: leaves } = useLeaves();

  return React.useMemo(() => {
    const byRecency = <T extends { _s: number }>(a: T, b: T) => a._s - b._s;

    const ap = approvals
      .filter(
        (a) =>
          a.bucket === "pending" &&
          a.status !== "Approved" &&
          a.status !== "Rejected",
      )
      .map((a) => ({
        id: `ap-${a.no}`,
        cat: "결재" as const,
        title: `결재 대기 · ${a.title}`,
        desc: `${a.author} 기안 · ${a.type}`,
        time: a.date,
        to: `/approval/${a.no}`,
        icon: "FileCheck2",
        _s: a.order,
      }))
      .sort(byRecency);

    const no = notices
      .filter((n) => n.unread)
      .map((n) => ({
        id: `no-${n.id}`,
        cat: "공지" as const,
        title: n.pinned ? `[필독] ${n.title}` : n.title,
        desc: `${n.author} · ${n.date}`,
        time: n.date,
        to: `/notice/${n.id}`,
        icon: "Megaphone",
        _s: n.order,
      }))
      .sort(byRecency);

    const lv = leaves
      .filter((l) => l.status !== "대기")
      .map((l) => ({
        id: `lv-${l.id}`,
        cat: "근태" as const,
        title: `${l.kind} 신청이 ${l.status}되었습니다`,
        desc:
          l.end && l.end !== l.start ? `${l.start} ~ ${l.end}` : l.start,
        time: l.start.slice(5).replace("-", "."),
        to: "/attendance",
        icon: l.status === "반려" ? "CircleX" : "CircleCheck",
        _s: -l.order,
      }))
      .sort(byRecency);

    return [...ap, ...no, ...lv].slice(0, 15).map((n) => ({
      id: n.id,
      cat: n.cat,
      title: n.title,
      desc: n.desc,
      time: n.time,
      to: n.to,
      icon: n.icon,
    }));
  }, [approvals, notices, leaves]);
}

/* ------------------------------------------------------------------ */
/*  시드 실행 (관리자 화면에서 호출)                                     */
/* ------------------------------------------------------------------ */

export async function runSeed(
  admin: { uid: string; email: string | null; name?: string | null } | null,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  if (!isFirebaseConfigured) throw new Error("Firebase 미설정");
  const db = firebaseDb();
  const seed = buildSeed();
  const total = seed.length + (admin ? 3 + 4 : 0); // +3 leaves 샘플 +4 events 샘플
  let done = 0;

  // 부트스트랩: 시드 실행자의 users/{uid} 문서가 없으면 SUPER_ADMIN 으로 생성
  // 이름은 실제 계정(displayName / 이메일 앞부분)에서 가져옵니다.
  if (admin) {
    const meRef = doc(db, COL.users, admin.uid);
    const meSnap = await getDoc(meRef);
    if (!meSnap.exists()) {
      const name =
        admin.name?.trim() ||
        (admin.email ? admin.email.split("@")[0] : "관리자");
      await setDoc(meRef, {
        uid: admin.uid,
        email: admin.email ?? "",
        name,
        departmentId: "",
        position: "관리자",
        employeeId: `CF-${admin.uid.slice(0, 6).toUpperCase()}`,
        joinedAt: new Date(),
        phone: "",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  for (const s of seed) {
    await setDoc(doc(db, s.collection, s.id), s.data, { merge: true });
    done += 1;
    onProgress?.(done, total);
  }

  // 시드 실행자 본인 앞으로 휴가·초과근무 신청 샘플 (leaves 는 uid 종속이라 여기서 생성)
  if (admin) {
    const who = admin.name?.trim() || admin.email?.split("@")[0] || "관리자";
    const y = new Date().getFullYear();
    const sampleLeaves = [
      { kind: "연차", start: `${y}-03-14`, end: `${y}-03-14`, days: 1, hours: 0, reason: "개인 사유", status: "승인" },
      { kind: "반차", start: `${y}-05-02`, end: `${y}-05-02`, days: 0.5, hours: 0, reason: "병원 진료", status: "승인" },
      { kind: "초과근무", start: `${y}-06-20`, end: `${y}-06-20`, days: 0, hours: 3, reason: "배포 대응", status: "대기" },
    ];
    for (let i = 0; i < sampleLeaves.length; i++) {
      await setDoc(doc(db, COL.leaves, `${admin.uid}-seed-${i}`), {
        uid: admin.uid,
        who,
        order: Date.now() - i * 1000,
        ...sampleLeaves[i],
      });
      done += 1;
      onProgress?.(done, total);
    }

    // 캘린더 일정 샘플 (events 는 owner 종속이라 여기서 생성 · 이번 달 기준)
    const n = new Date();
    const p2 = (x: number) => String(x).padStart(2, "0");
    const day = (d: number) =>
      `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(Math.min(28, Math.max(1, d)))}`;
    const catColor: Record<string, string> = {
      회의: "#4f46e5", 미팅: "#0ea5e9", 개인: "#16a34a", 마감: "#f59e0b", 기타: "#64748b",
    };
    const sampleEvents = [
      { title: "플랫폼 주간 스프린트 회의", date: day(n.getDate()), start: "10:00", finish: "11:00", category: "회의", location: "본사 7F 회의실 A" },
      { title: "결재 정책 유관부서 리뷰", date: day(n.getDate() + 1), start: "13:30", finish: "14:30", category: "미팅", location: "온라인 (Meet)" },
      { title: "신규 입사자 온보딩 멘토링", date: day(n.getDate() + 2), start: "15:00", finish: "16:00", category: "개인", location: "본사 5F 라운지" },
      { title: "월간 업무보고 상신 마감", date: day(25), start: "", finish: "", category: "마감", location: "전자결재" },
    ];
    for (let i = 0; i < sampleEvents.length; i++) {
      const e = sampleEvents[i];
      const allDay = !e.start;
      await setDoc(doc(db, COL.events, `${admin.uid}-evt-${i}`), {
        title: e.title,
        date: e.date,
        end: e.date,
        start: e.start,
        finish: e.finish,
        allDay,
        category: e.category,
        location: e.location,
        memo: "",
        owner: admin.uid,
        ownerName: who,
        color: catColor[e.category] ?? "#64748b",
        order:
          Number(e.date.replace(/-/g, "")) * 10000 +
          Number((e.start || "0000").replace(":", "")),
      });
      done += 1;
      onProgress?.(done, total);
    }
  }
  return done;
}
