"use client";

import * as React from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";
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
  COL,
  buildSeed,
  type ApprovalDoc,
  type AttendanceDoc,
  type BookingDoc,
  type NoticeDoc,
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
        order: -now.getTime(), // 최신 글이 위로 오도록
      });
    },
    [me.name, me.role],
  );

  return { ...state, addNotice };
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
    setOverlay((p) => ({ ...p, [t.id]: { done: nextDone } }));
    if (isFirebaseConfigured) {
      await updateDoc(doc(firebaseDb(), COL.tasks, t.id), { done: nextDone });
    }
  }, []);

  return { ...state, data, addTask, toggleDone };
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
        ...(input.reason ? { reason: input.reason } : {}),
      };
      setAdded((p) => [...p, { no: input.no, ...payload }]);
      if (isFirebaseConfigured) {
        await setDoc(doc(firebaseDb(), COL.approvals, input.no), payload);
      }
      return input.no;
    },
    [me.name, me.role],
  );

  return { ...state, data, createApproval };
}

export function useApprovalDoc(no: string) {
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
      setRemote((r) => (r ? { ...r, status } : r));
      if (isFirebaseConfigured) {
        await updateDoc(doc(firebaseDb(), COL.approvals, no), { status });
      }
    },
    [no],
  );

  return { doc: document, loading, setStatus };
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

  return { ...state, data, addBooking };
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

  return { people, loading, source, addPerson };
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
    weekWorked: cur.weekWorked ?? 32,
    history: cur.history ?? ATT_ROWS,
    source: remote ? ("firestore" as const) : ("fallback" as const),
    checkIn,
    checkOut,
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

  return {
    profile,
    canSave: !!authUser && !!profile && isFirebaseConfigured,
    save,
  };
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

  const save = React.useCallback(async (patch: Partial<WorkspaceDoc>) => {
    if (!isFirebaseConfigured) return;
    await setDoc(
      doc(firebaseDb(), COL.workspace, "main"),
      { ...patch, updatedAt: new Date() },
      { merge: true },
    );
  }, []);

  return { data, loading, save };
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
    onProgress?.(done, seed.length);
  }
  return done;
}
