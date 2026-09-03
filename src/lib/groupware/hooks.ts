"use client";

import * as React from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { useAuthUser } from "@/hooks/useAuthUser";
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
  type NoticeDoc,
  type TaskDoc,
} from "./firestore";

const two = (n: number) => String(n).padStart(2, "0");

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
  return useGwCollection<NoticeDoc>(COL.notices, NOTICE_FALLBACK);
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

  const addTask = React.useCallback(async (colKey: string, title: string) => {
    const id = String(Date.now());
    const task: TaskDoc = {
      id,
      colKey,
      tag: "기획",
      title,
      who: "김세진",
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
  }, []);

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

export function useApprovals() {
  return useGwCollection<ApprovalDoc>(COL.approvals, APPROVAL_FALLBACK);
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
  return { people, loading, source };
}

/* ------------------------------------------------------------------ */
/*  출퇴근 (attendance/{uid})                                           */
/* ------------------------------------------------------------------ */

const ATT_DEFAULT = {
  working: true,
  inAt: "09:02",
  outAt: "--:--",
  weekWorked: 32,
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
/*  시드 실행 (관리자 화면에서 호출)                                     */
/* ------------------------------------------------------------------ */

export async function runSeed(
  admin: { uid: string; email: string | null } | null,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  if (!isFirebaseConfigured) throw new Error("Firebase 미설정");
  const db = firebaseDb();
  const seed = buildSeed();
  let done = 0;

  // 부트스트랩: 시드 실행자의 users/{uid} 문서가 없으면 SUPER_ADMIN 으로 생성
  if (admin) {
    const meRef = doc(db, COL.users, admin.uid);
    const meSnap = await getDoc(meRef);
    if (!meSnap.exists()) {
      await setDoc(meRef, {
        uid: admin.uid,
        email: admin.email ?? "",
        name: "김세진",
        departmentId: "플랫폼개발팀",
        position: "과장",
        employeeId: "CF-DEMO-001",
        joinedAt: new Date("2023-03-02"),
        phone: "010-0000-0000",
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
