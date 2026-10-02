"use client";

import * as React from "react";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  type Query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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
import { localDateStr } from "@/lib/utils";
import type { UserDoc, UserSecretsDoc } from "@/types/user";
import {
  APPROVAL_ROWS,
  ATT_ROWS,
  BOARD,
  NOTICE_ALL,
  NOTICE_PINNED,
  type Person,
} from "./data";
import {
  CHAT_FILE_MAX_BYTES,
  CHAT_FILE_MAX_MB,
  COL,
  EVENT_CATEGORIES,
  TASK_COLUMNS,
  approvalCommentsPath,
  buildSeed,
  calculateLeaveBalance,
  chatMessagesPath,
  dmChatId,
  isNoticeUnread,
  noticeCommentsPath,
  taskCommentsPath,
  type ApprovalCommentDoc,
  type ApprovalDoc,
  type AttendanceDoc,
  type BookingDoc,
  type ChatDoc,
  type ChatMessageDoc,
  type EventDoc,
  type LeaveDoc,
  type NoticeCommentDoc,
  type NoticeDoc,
  type SessionDoc,
  type TaskCommentDoc,
  type TaskDoc,
  type TeamDoc,
  type WorkspaceDoc,
} from "./firestore";

const two = (n: number) => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ */
/*  현재 로그인 사용자 (프로필 우선, 이메일 앞부분으로 폴백)             */
/* ------------------------------------------------------------------ */

export function useCurrentUser() {
  const { authUser, profile, loading, logout } = useAuthUser();
  const { teams } = useTeams();
  const email = profile?.email ?? authUser?.email ?? null;
  const name =
    profile?.name ||
    authUser?.displayName ||
    (email ? email.split("@")[0] : "게스트");
  const team = teams.find((t) => t.id === profile?.teamId)?.name ?? "";
  return {
    uid: authUser?.uid ?? null,
    teamId: profile?.teamId ?? null,
    name,
    role: profile?.position ?? "",
    team,
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

/**
 * notices 컬렉션 구독 — 관리자는 전체, 일반 사용자는 "게시된 공지 +
 * 본인이 작성한 공지(임시저장 포함)"만 구독합니다.
 *
 * firestore.rules의 notices read 규칙이 draft는 작성자 본인/관리자만
 * 보이도록 좁혀져 있어(예전엔 "로그인만 하면 허용"이라 다른 사람의 임시
 * 저장 공지도 전역 검색·URL 직접 접속으로 열람 가능했음), where 없이
 * 컬렉션 전체를 구독하면 draft 문서가 하나라도 있는 순간 list 쿼리
 * 자체가 거부됩니다(approvals와 동일한 이유 — hooks.ts의
 * useApprovalCollection 주석 참고). 그래서 where로 범위를 증명할 수
 * 있는 쿼리 두 개로 나눠 구독합니다.
 */
function useNoticeCollection(): { data: NoticeDoc[]; loading: boolean } {
  const { authUser, profile, loading: authLoading } = useAuthUser();
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const uid = authUser?.uid ?? null;

  const [state, setState] = React.useState<{ data: NoticeDoc[]; loading: boolean }>({
    data: NOTICE_FALLBACK,
    loading: isFirebaseConfigured,
  });

  React.useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (authLoading || !uid) return;

    if (isAdmin) {
      const q = query(collection(firebaseDb(), COL.notices), orderBy("order"));
      return onSnapshot(
        q,
        (snap) => {
          setState(
            snap.empty
              ? { data: NOTICE_FALLBACK, loading: false }
              : {
                  data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticeDoc),
                  loading: false,
                },
          );
        },
        () => setState({ data: NOTICE_FALLBACK, loading: false }),
      );
    }

    type SliceKey = "published" | "authored";
    const slices: Record<SliceKey, NoticeDoc[]> = { published: [], authored: [] };
    const loaded: Record<SliceKey, boolean> = { published: false, authored: false };

    const emit = () => {
      if (!loaded.published || !loaded.authored) return;
      const merged = new Map<string, NoticeDoc>();
      for (const list of Object.values(slices)) {
        for (const d of list) merged.set(d.id, d);
      }
      const list = Array.from(merged.values()).sort((a, b) => a.order - b.order);
      setState(list.length ? { data: list, loading: false } : { data: NOTICE_FALLBACK, loading: false });
    };

    const subscribe = (key: SliceKey, q: Query) =>
      onSnapshot(
        q,
        (snap) => {
          slices[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticeDoc);
          loaded[key] = true;
          emit();
        },
        () => {
          loaded[key] = true;
          emit();
        },
      );

    const unsubs = [
      subscribe("published", query(collection(firebaseDb(), COL.notices), where("status", "!=", "draft"))),
      subscribe("authored", query(collection(firebaseDb(), COL.notices), where("authorUid", "==", uid))),
    ];
    return () => unsubs.forEach((u) => u());
  }, [isAdmin, uid, authLoading]);

  return state;
}

export function useNotices() {
  const state = useNoticeCollection();
  const me = useCurrentUser();

  /** draft=true면 임시저장(본인에게만 보이고 전사 알림도 안 나감) */
  const addNotice = React.useCallback(
    async (
      input: { cat: string; title: string; body: string; pinned: boolean },
      draft: boolean,
    ) => {
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
        ...(me.uid ? { authorUid: me.uid } : {}),
        date,
        views: 0,
        attach: false,
        pinned: input.pinned,
        comments: 0,
        status: draft ? "draft" : "published",
        order: -now.getTime(), // 최신 글이 위로 오도록
      });
      if (!draft) {
        notifySlack(
          `${input.pinned ? "📌 " : ""}[공지] ${input.title}\n${author} · ${input.body.slice(0, 140)}`,
          input.title,
        ).catch(() => {});
      }
      return id;
    },
    [me.name, me.role, me.uid],
  );

  /**
   * 임시저장한 글을 계속 수정하거나(draft=true), 최종 게시(draft=false)합니다.
   * 이미 게시된 공지를 다시 수정할 때는 announce=false로 넘겨 Slack 재알림 없이
   * 내용만 갱신합니다(announce 기본값은 !draft — 임시저장→최초 게시 전환 시엔 알림).
   */
  const updateNotice = React.useCallback(
    async (
      id: string,
      input: { cat: string; title: string; body: string; pinned: boolean },
      draft: boolean,
      announce: boolean = !draft,
    ) => {
      if (!isFirebaseConfigured) return;
      const patch: Partial<NoticeDoc> = {
        cat: input.cat,
        title: input.title,
        body: input.body,
        pinned: input.pinned,
        status: draft ? "draft" : "published",
        // 게시(또는 게시된 글 재수정) 시 읽음 기록을 비워 모두에게 다시
        // "안 읽음"으로 보이게 합니다 — 예전엔 문서당 하나뿐인 unread 필드를
        // true로 되돌리는 방식이었는데, 이제는 사용자별 readByUids라 빈
        // 배열로 리셋하는 것이 동일한 효과입니다.
        ...(draft ? {} : { readByUids: [] }),
      };
      await updateDoc(doc(firebaseDb(), COL.notices, id), patch);
      if (announce) {
        const author = me.role ? `${me.name} ${me.role}` : me.name;
        notifySlack(
          `${input.pinned ? "📌 " : ""}[공지] ${input.title}\n${author} · ${input.body.slice(0, 140)}`,
          input.title,
        ).catch(() => {});
      }
    },
    [me.name, me.role],
  );

  return { ...state, addNotice, updateNotice };
}

/**
 * 공지 1건 구독 — approvals의 useApprovalDoc과 동일하게 단건 문서를 직접
 * 구독합니다(목록 전체를 받아와 find하지 않음). draft인 남의 공지는
 * firestore.rules가 단건 조회에서도 막으므로, 전체를 받아올 필요가
 * 없을뿐더러 받아와서도 안 됩니다.
 */
export function useNoticeDoc(id: string) {
  const { authUser } = useAuthUser();
  const uid = authUser?.uid ?? null;
  const [remote, setRemote] = React.useState<NoticeDoc | null | undefined>(() =>
    isFirebaseConfigured ? undefined : (NOTICE_FALLBACK.find((n) => n.id === id) ?? null),
  );

  React.useEffect(() => {
    if (!isFirebaseConfigured || !id) return;
    const unsub = onSnapshot(
      doc(firebaseDb(), COL.notices, id),
      (snap) =>
        setRemote(snap.exists() ? ({ id: snap.id, ...snap.data() } as NoticeDoc) : null),
      () => setRemote(null),
    );
    return () => {
      unsub();
      setRemote(undefined);
    };
  }, [id]);

  const fallback = NOTICE_FALLBACK.find((n) => n.id === id) ?? null;
  const notice =
    remote === undefined ? (isFirebaseConfigured ? null : fallback) : (remote ?? fallback);
  const loading = isFirebaseConfigured && remote === undefined;

  React.useEffect(() => {
    if (!isFirebaseConfigured || !id || !uid) return;
    updateDoc(doc(firebaseDb(), COL.notices, id), {
      views: increment(1),
      readByUids: arrayUnion(uid),
    }).catch(() => {});
  }, [id, uid]);

  return { notice, loading };
}

/** 공지 댓글 — notices/{id}/comments 서브컬렉션 */
export function useNoticeComments(noticeId: string) {
  const me = useCurrentUser();
  const { authUser, profile } = useAuthUser();
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
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

  /** 본인 댓글만 — Firestore 규칙도 uid == 본인만 허용 */
  const updateComment = React.useCallback(
    async (commentId: string, body: string) => {
      const text = body.trim();
      if (!text || !isFirebaseConfigured) return;
      await updateDoc(doc(firebaseDb(), noticeCommentsPath(noticeId), commentId), {
        body: text,
        edited: true,
      });
    },
    [noticeId],
  );

  /** 본인 댓글 또는 관리자/최상위 관리자 — Firestore 규칙에서 함께 검증 */
  const removeComment = React.useCallback(
    async (commentId: string) => {
      if (!isFirebaseConfigured) return;
      await deleteDoc(doc(firebaseDb(), noticeCommentsPath(noticeId), commentId));
      await updateDoc(doc(firebaseDb(), COL.notices, noticeId), {
        comments: increment(-1),
      }).catch(() => {});
    },
    [noticeId],
  );

  return {
    comments,
    loading,
    addComment,
    updateComment,
    removeComment,
    myUid: authUser?.uid ?? null,
    isAdmin,
  };
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

export interface TaskInput {
  colKey: string;
  tag: string;
  title: string;
  desc: string;
  who: string;
  assigneeId: string | null;
  teamId: string | null;
  startDate: string; // yyyy-mm-dd ("" = 미설정)
  dueDate: string; // yyyy-mm-dd ("" = 미설정)
  time: string; // HH:MM ("" = 미설정)
}

const TASK_DONE_COL = TASK_COLUMNS[TASK_COLUMNS.length - 1].key;

/** dueDate 기준 D-day 라벨 계산 (완료 컬럼이면 항상 "완료") */
function computeDday(colKey: string, dueDate?: string, fallback = "D-7"): string {
  if (colKey === TASK_DONE_COL) return "완료";
  if (!dueDate) return fallback;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "D-Day";
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

export function useTasks() {
  const state = useGwCollection<TaskDoc>(COL.tasks, TASK_FALLBACK);
  const me = useCurrentUser();
  // 낙관적 오버레이 (Firebase 미설정 시엔 이게 유일한 저장소)
  const [overlay, setOverlay] = React.useState<Record<string, Partial<TaskDoc> | null>>(
    {},
  );
  const [added, setAdded] = React.useState<TaskDoc[]>([]);

  const data = React.useMemo(() => {
    const base = state.data
      .map((t) => (overlay[t.id] ? { ...t, ...overlay[t.id] } : t))
      .filter((t): t is TaskDoc => overlay[t.id] !== null);
    const extra = added
      .filter((a) => !state.data.some((t) => t.id === a.id) && overlay[a.id] !== null)
      .map((a) => (overlay[a.id] ? { ...a, ...overlay[a.id] } : a));
    return [...base, ...extra].map((t) => ({
      ...t,
      dday: t.dueDate ? computeDday(t.colKey, t.dueDate) : computeDday(t.colKey, undefined, t.dday),
    }));
  }, [state.data, overlay, added]);

  const addTask = React.useCallback(
    async (input: TaskInput) => {
      const id = String(Date.now());
      const order =
        Math.max(
          -1,
          ...data.filter((t) => t.colKey === input.colKey).map((t) => t.order),
        ) + 1;
      const payload: Omit<TaskDoc, "id"> = {
        colKey: input.colKey,
        tag: input.tag.trim() || "기획",
        title: input.title.trim(),
        desc: input.desc.trim(),
        who: input.who.trim() || me.name,
        assigneeId: input.assigneeId,
        teamId: input.teamId,
        startDate: input.startDate,
        dueDate: input.dueDate,
        time: input.time,
        dday: computeDday(input.colKey, input.dueDate),
        done: 0,
        total: 3,
        order,
      };
      setAdded((p) => [...p, { id, ...payload }]);
      if (isFirebaseConfigured) {
        await setDoc(doc(firebaseDb(), COL.tasks, id), payload);
      }
    },
    [me.name, data],
  );

  const saveTask = React.useCallback(async (id: string, input: TaskInput) => {
    const patch: Partial<TaskDoc> = {
      tag: input.tag.trim() || "기획",
      title: input.title.trim(),
      desc: input.desc.trim(),
      who: input.who.trim(),
      assigneeId: input.assigneeId,
      teamId: input.teamId,
      startDate: input.startDate,
      dueDate: input.dueDate,
      time: input.time,
    };
    setOverlay((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
    if (isFirebaseConfigured) {
      await updateDoc(doc(firebaseDb(), COL.tasks, id), patch);
    }
  }, []);

  const removeTask = React.useCallback(async (id: string) => {
    setOverlay((p) => ({ ...p, [id]: null }));
    setAdded((p) => p.filter((t) => t.id !== id));
    if (isFirebaseConfigured) {
      await deleteDoc(doc(firebaseDb(), COL.tasks, id));
    }
  }, []);

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

  /**
   * 드래그 앤 드롭으로 카드를 컬럼(진행 상태) 사이 · 컬럼 내부에서 이동.
   * beforeId 가 있으면 그 카드 앞에 삽입, 없으면 컬럼 맨 끝에 삽입.
   * 영향받은 컬럼(들)의 order 를 0..n 으로 다시 매깁니다.
   */
  const moveTaskTo = React.useCallback(
    async (taskId: string, targetCol: string, beforeId: string | null) => {
      const moved = data.find((t) => t.id === taskId);
      if (!moved) return;
      const sourceCol = moved.colKey;

      const targetItems = data
        .filter((t) => t.colKey === targetCol && t.id !== taskId)
        .sort((a, b) => a.order - b.order);
      const insertAt = beforeId
        ? targetItems.findIndex((t) => t.id === beforeId)
        : -1;
      targetItems.splice(
        insertAt === -1 ? targetItems.length : insertAt,
        0,
        { ...moved, colKey: targetCol },
      );

      const patchMap: Record<string, Partial<TaskDoc>> = {};
      targetItems.forEach((t, i) => {
        if (t.id === taskId) {
          // 이동한 카드는 컬럼이 그대로여도 순서가 바뀌었을 수 있어 항상 반영
          patchMap[t.id] = {
            order: i,
            colKey: targetCol,
            ...(targetCol === TASK_DONE_COL ? { done: moved.total } : {}),
          };
        } else if (t.order !== i) {
          patchMap[t.id] = { order: i };
        }
      });

      if (sourceCol !== targetCol) {
        const sourceItems = data
          .filter((t) => t.colKey === sourceCol && t.id !== taskId)
          .sort((a, b) => a.order - b.order);
        sourceItems.forEach((t, i) => {
          if (t.order !== i) {
            patchMap[t.id] = { ...patchMap[t.id], order: i };
          }
        });
      }

      if (Object.keys(patchMap).length === 0) return;

      setOverlay((p) => {
        const next = { ...p };
        for (const [id, patch] of Object.entries(patchMap)) {
          next[id] = { ...next[id], ...patch };
        }
        return next;
      });
      if (isFirebaseConfigured) {
        await Promise.all(
          Object.entries(patchMap).map(([id, patch]) =>
            updateDoc(doc(firebaseDb(), COL.tasks, id), patch),
          ),
        );
      }
    },
    [data],
  );

  return {
    ...state,
    data,
    addTask,
    saveTask,
    removeTask,
    toggleDone,
    moveTask,
    moveTaskTo,
  };
}

/** Task 댓글 — tasks/{id}/comments 서브컬렉션. 카드 목록마다 구독을 걸지
 *  않도록 Task 상세 모달이 열려 있을 때만(taskId가 있을 때만) 호출합니다. */
export function useTaskComments(taskId: string) {
  const me = useCurrentUser();
  const { authUser, profile } = useAuthUser();
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const [data, setData] = React.useState<TaskCommentDoc[]>([]);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);
  const [added, setAdded] = React.useState<TaskCommentDoc[]>([]);

  React.useEffect(() => {
    if (!isFirebaseConfigured || !taskId) return;
    const q = query(
      collection(firebaseDb(), taskCommentsPath(taskId)),
      orderBy("order"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskCommentDoc),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [taskId]);

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
      const payload: Omit<TaskCommentDoc, "id"> = {
        uid: authUser?.uid ?? "local",
        author: me.name,
        role: me.role,
        body: text,
        at,
        order: now.getTime(),
      };
      setAdded((p) => [...p, { id, ...payload }]);
      if (isFirebaseConfigured) {
        await setDoc(doc(firebaseDb(), taskCommentsPath(taskId), id), payload);
      }
    },
    [taskId, me.name, me.role, authUser?.uid],
  );

  /** 본인 댓글만 — Firestore 규칙도 uid == 본인만 허용 */
  const updateComment = React.useCallback(
    async (commentId: string, body: string) => {
      const text = body.trim();
      if (!text || !isFirebaseConfigured) return;
      await updateDoc(doc(firebaseDb(), taskCommentsPath(taskId), commentId), {
        body: text,
        edited: true,
      });
    },
    [taskId],
  );

  /** 본인 댓글 또는 관리자/최상위 관리자 — Firestore 규칙에서 함께 검증 */
  const removeComment = React.useCallback(
    async (commentId: string) => {
      if (!isFirebaseConfigured) return;
      await deleteDoc(doc(firebaseDb(), taskCommentsPath(taskId), commentId));
    },
    [taskId],
  );

  return {
    comments,
    loading,
    addComment,
    updateComment,
    removeComment,
    myUid: authUser?.uid ?? null,
    isAdmin,
  };
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
  leaveRequest?: ApprovalDoc["leaveRequest"];
  draftState?: ApprovalDoc["draftState"];
};

/**
 * approvals 컬렉션 실시간 구독 — 관리자는 전체, 일반 사용자는 "본인이
 * 관련된 문서"만 구독합니다.
 *
 * firestore.rules 의 approvals read 규칙이 authorUid/currentApproverUid/
 * approverUids 중 하나가 request.auth.uid 와 일치하거나 관리자일 때만
 * 허용하도록 좁혀져 있어(전사 결재함 공개 → 기안자/결재라인/관리자만
 * 열람으로 전환), 예전처럼 컬렉션 전체를 where 없이 구독하면 Firestore가
 * "잠재적 결과 중 하나라도 규칙을 위반할 수 있는" list 쿼리 자체를
 * 통째로 거부합니다(부분 필터링이 아님). 그래서 관리자가 아니면 반드시
 * where 로 범위를 증명할 수 있는 쿼리 여러 개로 나눠 구독해야 합니다.
 */
function useApprovalCollection(): { data: ApprovalDoc[]; loading: boolean; source: Source } {
  const { authUser, profile, loading: authLoading } = useAuthUser();
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const uid = authUser?.uid ?? null;

  const [state, setState] = React.useState<{
    data: ApprovalDoc[];
    loading: boolean;
    source: Source;
  }>({ data: APPROVAL_FALLBACK, loading: isFirebaseConfigured, source: "fallback" });

  React.useEffect(() => {
    if (!isFirebaseConfigured) return;
    // 로그인/프로필 로딩이 끝나기 전엔 관리자 여부를 알 수 없어 구독을
    // 미룹니다 — 좁은 쿼리로 먼저 구독했다가 admin 확정 후 다시 넓히면
    // 목록이 깜빡이는 걸 방지.
    if (authLoading || !uid) return;

    if (isAdmin) {
      const q = query(collection(firebaseDb(), COL.approvals), orderBy("order"));
      return onSnapshot(
        q,
        (snap) => {
          setState(
            snap.empty
              ? { data: APPROVAL_FALLBACK, loading: false, source: "fallback" }
              : {
                  data: snap.docs.map(
                    (d) => ({ id: d.id, ...d.data() }) as unknown as ApprovalDoc,
                  ),
                  loading: false,
                  source: "firestore",
                },
          );
        },
        () => setState({ data: APPROVAL_FALLBACK, loading: false, source: "fallback" }),
      );
    }

    // 일반 사용자: "기안자 본인" · "결재라인 소속(approverUids)" · "현재
    // 결재 차례(currentApproverUid — approverUids 필드가 없는 구 문서용
    // 폴백)" 세 쿼리를 따로 구독해 클라이언트에서 합칩니다.
    type SliceKey = "authored" | "involved" | "current";
    const slices: Record<SliceKey, ApprovalDoc[]> = { authored: [], involved: [], current: [] };
    const loaded: Record<SliceKey, boolean> = { authored: false, involved: false, current: false };

    const emit = () => {
      if (!loaded.authored || !loaded.involved || !loaded.current) return;
      const merged = new Map<string, ApprovalDoc>();
      for (const list of Object.values(slices)) {
        for (const d of list) {
          merged.set((d as unknown as { id: string }).id ?? d.no, d);
        }
      }
      const list = Array.from(merged.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setState(
        list.length
          ? { data: list, loading: false, source: "firestore" }
          : { data: APPROVAL_FALLBACK, loading: false, source: "fallback" },
      );
    };

    const subscribe = (key: SliceKey, field: string, op: "==" | "array-contains") =>
      onSnapshot(
        query(collection(firebaseDb(), COL.approvals), where(field, op, uid)),
        (snap) => {
          slices[key] = snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as unknown as ApprovalDoc,
          );
          loaded[key] = true;
          emit();
        },
        () => {
          loaded[key] = true;
          emit();
        },
      );

    const unsubs = [
      subscribe("authored", "authorUid", "=="),
      subscribe("involved", "approverUids", "array-contains"),
      subscribe("current", "currentApproverUid", "=="),
    ];
    return () => unsubs.forEach((u) => u());
  }, [isAdmin, uid, authLoading]);

  // 로그인 정보가 없을 때는 effect 안에서 setState 로 되돌리는 대신 여기서
  // 그대로 파생시킵니다(react-hooks/set-state-in-effect 회피 + 더 정확함 —
  // uid 가 사라지는 즉시 이전 구독 결과가 아닌 폴백을 보여줘야 함).
  if (!isFirebaseConfigured || authLoading) return state;
  if (!uid) return { data: APPROVAL_FALLBACK, loading: false, source: "fallback" };
  return state;
}

export function useApprovals() {
  const state = useApprovalCollection();
  const me = useCurrentUser();
  // 낙관적 추가 (Firebase 미설정 시엔 이게 유일한 저장소)
  const [added, setAdded] = React.useState<ApprovalDoc[]>([]);

  const data = React.useMemo(() => {
    // Firestore 문서 데이터엔 "no" 필드가 없을 수 있어(id만 있음) 문서 id로 보정
    const base = state.data.map((r) =>
      r.no ? r : { ...r, no: (r as unknown as { id: string }).id },
    );
    const extra = added.filter((a) => !base.some((d) => d.no === a.no));
    return [...base, ...extra];
  }, [state.data, added]);

  const createApproval = React.useCallback(
    async (input: NewApproval) => {
      const now = new Date();
      const date = `${two(now.getMonth() + 1)}.${two(now.getDate())}`;
      const author = me.role ? `${me.name} ${me.role}` : me.name;
      // 결재선의 첫 결재(기안 다음) 단계 uid = 현재 결재 차례. 이 값으로
      // "본인 차례가 아니면 승인/반려 불가"를 판단합니다.
      const firstApproverUid =
        (input.line ?? []).find((l) => l.kind !== "기안")?.uid ?? null;
      // 결재 문서 열람 권한(firestore.rules/storage.rules) 판정용 — line
      // 각 단계(기안 포함)의 uid 를 중복 없이 평탄화. line 은 객체 배열이라
      // 보안 규칙에서 바로 필터링할 수 없어 별도 필드로 둡니다.
      const approverUids = Array.from(
        new Set((input.line ?? []).map((l) => l.uid).filter((u): u is string => !!u)),
      );
      const payload: ApprovalDoc = {
        no: input.no,
        type: input.type,
        title: input.title,
        author,
        date,
        approver: input.approver,
        status: input.status,
        bucket: input.bucket,
        currentApproverUid: firstApproverUid,
        order: -now.getTime(), // 최신 문서가 위로
        // Firestore setDoc은 값이 literal undefined인 필드가 있으면 그 자리에서
        // 예외를 던지므로(ignoreUndefinedProperties 미설정), me.uid가 없을 때
        // authorUid 키 자체를 아예 넣지 않습니다 — 이 값이 undefined로 새면
        // 기안 저장이 에러 메시지 하나 없이 그냥 실패합니다.
        ...(me.uid ? { authorUid: me.uid } : {}),
        ...(input.line ? { line: input.line } : {}),
        ...(approverUids.length ? { approverUids } : {}),
        ...(input.meta ? { meta: input.meta } : {}),
        ...(input.rows ? { rows: input.rows } : {}),
        ...(input.attachments && input.attachments.length
          ? { attachments: input.attachments }
          : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.leaveRequest ? { leaveRequest: input.leaveRequest } : {}),
        ...(input.draftState ? { draftState: input.draftState } : {}),
      };
      setAdded((p) => [...p, payload]);
      if (isFirebaseConfigured) {
        await setDoc(doc(firebaseDb(), COL.approvals, input.no), payload);
      }
      // 임시저장(bucket "drafted")은 아직 상신 전이라 전사 알림을 보내지
      // 않습니다 — "결재 요청하기"로 실제 상신될 때만 알립니다.
      if (input.bucket === "pending") {
        notifySlack(
          `[결재 상신] ${input.title} (${input.no})\n기안자 ${author} · 결재자 ${input.approver}`,
          input.title,
        ).catch(() => {});
      }
      return input.no;
    },
    [me.name, me.role, me.uid],
  );

  const removeApproval = React.useCallback(
    async (no: string) => {
      setAdded((p) => p.filter((a) => a.no !== no));
      if (isFirebaseConfigured) {
        await deleteDoc(doc(firebaseDb(), COL.approvals, no));
      }
    },
    [],
  );

  return { ...state, data, createApproval, removeApproval };
}

/**
 * 문서가 "지금 이 사람 결재 차례"인지 판정 — 결재 목록/집계(내 업무, 전자결재
 * 대기함)와 상세 페이지 버튼 노출이 모두 이 기준을 공유해야 건수가 어긋나지
 * 않습니다. currentApproverUid 가 있으면 그것으로, 없는 레거시 문서는
 * line[].uid → 이름 순으로 폴백합니다.
 */
export function isPendingApprover(
  a: Pick<ApprovalDoc, "status" | "line" | "currentApproverUid">,
  me: { uid: string | null; name: string },
): boolean {
  if (a.status === "Approved" || a.status === "Rejected") return false;
  const pendingStep = (a.line ?? []).find((l) => l.kind !== "기안" && !l.done);
  if (!pendingStep) return false;
  if (a.currentApproverUid != null) return a.currentApproverUid === me.uid;
  if (pendingStep.uid) return pendingStep.uid === me.uid;
  return pendingStep.name === me.name;
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
    // no가 빈 문자열이면 doc()이 잘못된 경로로 예외를 던지므로 구독하지
    // 않습니다 — /approval/new 가 편집 대상 없이(?edit 파라미터 없이)
    // useApprovalDoc("") 을 호출하는 경우가 이에 해당합니다.
    if (!isFirebaseConfigured || !no) return;
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

  /**
   * 승인/반려는 결재선의 "현재 대기 중인 단계"에 해당하는 본인만 수행할 수
   * 있습니다 — 기안자 본인이거나 자기 차례가 아닌 사용자가 임의로 문서를
   * 승인/반려하지 못하도록 클라이언트에서 먼저 막고(서버는 firestore.rules
   * 의 currentApproverUid 검사가 최종 방어선입니다).
   */
  const setStatus = React.useCallback(
    async (status: "Approved" | "Rejected") => {
      if (!document || document.status === "Approved" || document.status === "Rejected") {
        throw new Error("이미 완결되었거나 존재하지 않는 문서입니다.");
      }
      const line = document.line ?? [];
      const stepIndex = line.findIndex((l) => l.kind !== "기안" && !l.done);
      if (!isPendingApprover(document, me)) {
        throw new Error("본인의 결재 순서가 아니므로 승인/반려할 수 없습니다.");
      }

      const title = document.title ?? "";
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const at = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(
        now.getDate(),
      )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const nextLine = line.map((l, i) =>
        i === stepIndex
          ? { ...l, state: status === "Approved" ? "승인" : "반려", done: status === "Approved", at }
          : l,
      );
      const isLastStep = stepIndex === line.length - 1;
      const nextStatus: string =
        status === "Rejected" ? "Rejected" : isLastStep ? "Approved" : "In Progress";
      const nextApproverUid =
        status === "Rejected" || isLastStep ? null : (nextLine[stepIndex + 1]?.uid ?? null);

      setRemote((r) =>
        r ? { ...r, status: nextStatus, line: nextLine, currentApproverUid: nextApproverUid } : r,
      );
      if (isFirebaseConfigured) {
        // 결재 문서를 먼저 확정한 뒤 연차 반영 — leaves 생성 규칙이 이 문서의
        // status == "Approved" 를 근거로 승인 여부를 검증합니다(순서 중요).
        await updateDoc(doc(firebaseDb(), COL.approvals, no), {
          status: nextStatus,
          line: nextLine,
          currentApproverUid: nextApproverUid,
        });
        // 휴가신청서가 최종 승인되면 실제 연차 잔여(leaves 컬렉션 기반 balance)에서
        // 차감되도록 leaves/{no} 문서를 생성합니다 — 같은 문서번호를 id로 써서
        // 재승인 등으로 중복 생성되지 않게 합니다.
        if (nextStatus === "Approved" && document.type === "휴가" && document.leaveRequest && document.authorUid) {
          const lr = document.leaveRequest;
          await setDoc(doc(firebaseDb(), COL.leaves, no), {
            uid: document.authorUid,
            who: document.author,
            kind: lr.kind,
            start: lr.start,
            end: lr.end,
            days: lr.days,
            hours: 0,
            reason: document.reason ?? "",
            status: "승인",
            order: now.getTime(),
          } satisfies Omit<LeaveDoc, "id">);
        }
      }
      const label =
        nextStatus === "Approved" ? "승인" : nextStatus === "Rejected" ? "반려" : "결재 진행";
      notifySlack(
        `[결재 ${label}] ${title || no} (${no}) · ${me.name}`,
        title || no,
      ).catch(() => {});
    },
    [no, me, document],
  );

  /**
   * 기안 취소 — 아직 승인/반려로 완결되지 않은 문서를 기안자 본인이 삭제해
   * 상신을 철회합니다(임시저장 상태도 포함). 완결된 문서는 leaves 반영 등
   * 후속 효과가 있어 취소 대상에서 제외합니다.
   */
  const cancelApproval = React.useCallback(async () => {
    if (!document) return;
    if (document.status === "Approved" || document.status === "Rejected") {
      throw new Error("이미 완결된 문서는 취소할 수 없습니다.");
    }
    if (!me.uid || document.authorUid !== me.uid) {
      throw new Error("본인이 기안한 문서만 취소할 수 있습니다.");
    }
    if (isFirebaseConfigured) {
      await deleteDoc(doc(firebaseDb(), COL.approvals, no));
    }
  }, [no, me.uid, document]);

  return {
    doc: document,
    loading,
    setStatus,
    cancelApproval,
    myUid: me.uid,
  };
}

/** 결재 의견 — approvals/{no}/comments 서브컬렉션. tasks/notices 댓글과 동일
 *  패턴 — 문서 상세를 열었을 때만(no가 있을 때만) 구독합니다. */
export function useApprovalComments(no: string) {
  const me = useCurrentUser();
  const { authUser, profile } = useAuthUser();
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const [data, setData] = React.useState<ApprovalCommentDoc[]>([]);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);
  const [added, setAdded] = React.useState<ApprovalCommentDoc[]>([]);

  React.useEffect(() => {
    if (!isFirebaseConfigured || !no) return;
    const q = query(
      collection(firebaseDb(), approvalCommentsPath(no)),
      orderBy("order"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ApprovalCommentDoc),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [no]);

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
      const payload: Omit<ApprovalCommentDoc, "id"> = {
        uid: authUser?.uid ?? "local",
        author: me.name,
        role: me.role || "결재자",
        body: text,
        at,
        order: now.getTime(),
      };
      setAdded((p) => [...p, { id, ...payload }]);
      if (isFirebaseConfigured) {
        await setDoc(doc(firebaseDb(), approvalCommentsPath(no), id), payload);
      }
    },
    [no, me.name, me.role, authUser?.uid],
  );

  /** 본인 의견만 — Firestore 규칙도 uid == 본인만 허용 */
  const updateComment = React.useCallback(
    async (commentId: string, body: string) => {
      const text = body.trim();
      if (!text || !isFirebaseConfigured) return;
      await updateDoc(doc(firebaseDb(), approvalCommentsPath(no), commentId), {
        body: text,
        edited: true,
      });
    },
    [no],
  );

  /** 본인 의견 또는 관리자만 — Firestore 규칙에서 함께 검증 */
  const removeComment = React.useCallback(
    async (commentId: string) => {
      if (!isFirebaseConfigured) return;
      await deleteDoc(doc(firebaseDb(), approvalCommentsPath(no), commentId));
    },
    [no],
  );

  return {
    comments,
    loading,
    addComment,
    updateComment,
    removeComment,
    myUid: authUser?.uid ?? null,
    isAdmin,
  };
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
      teamId: me.teamId,
      color: eventColor(input.category),
      order: eventOrder(input.date, input.allDay ? "" : input.start),
    }),
    [uid, me.name, me.teamId],
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
      attendees?: string[];
      video?: boolean;
      provider?: string;
      meetingUrl?: string;
    }) => {
      const id = String(Date.now());
      const now = new Date();
      const payload: Omit<BookingDoc, "id"> = {
        res: input.res,
        from: input.from,
        to: input.to,
        title: input.title,
        who: me.name,
        date: localDateStr(now),
        purpose: input.purpose ?? "",
        attendees: input.attendees ?? [],
        video: input.video ?? false,
        provider: input.provider ?? "",
        meetingUrl: input.video ? (input.meetingUrl ?? "").trim() : "",
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

export interface TeamInput {
  name: string;
  parentId: string | null;
}

/** 부서/팀 편제 — teams/{id} (parentId 로 본부-팀 계층) */
export function useTeams() {
  const state = useGwCollection<TeamDoc>(COL.teams, [], "order");

  const addTeam = React.useCallback(
    async (input: TeamInput) => {
      if (!isFirebaseConfigured) return;
      const id = String(Date.now());
      const order =
        Math.max(-1, ...state.data.map((t) => t.order)) + 1;
      await setDoc(doc(firebaseDb(), COL.teams, id), {
        name: input.name,
        parentId: input.parentId,
        order,
      });
      return id;
    },
    [state.data],
  );

  const updateTeam = React.useCallback(
    async (id: string, patch: Partial<TeamInput>) => {
      if (!isFirebaseConfigured) return;
      await updateDoc(doc(firebaseDb(), COL.teams, id), patch);
    },
    [],
  );

  const removeTeam = React.useCallback(async (id: string) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(firebaseDb(), COL.teams, id));
  }, []);

  return {
    teams: state.data,
    loading: state.loading,
    source: state.source,
    addTeam,
    updateTeam,
    removeTeam,
  };
}

export interface PersonInput {
  name: string;
  role: string;
  teamId: string | null;
  email: string;
  ext: string;
  mobile: string;
  status: Person["status"];
  boss: string | null;
  tags: string[];
}

/**
 * 임직원 디렉토리 — Firestore `users` 컬렉션이 단일 소스입니다(가계정은
 * `users/{placeholder-…}`, status: "PLACEHOLDER"). `teams` 와 합쳐서 조직도
 * 화면이 쓰는 `Person` 모양으로 변환해 돌려줍니다.
 *
 * useGwCollection 의 orderField 는 반드시 모든 문서에 항상 있는 필드여야
 * 합니다 — UserDoc 에는 "id"/"order" 필드가 없어 그걸 넘기면 Firestore 가
 * 문서를 전부 결과에서 제외해 목록이 조용히 비어버립니다("name" 사용).
 */
export function useOrgPeople() {
  const state = useGwCollection<UserDoc>(COL.users, [], "name");
  const { teams } = useTeams();

  const deptOf = React.useCallback(
    (teamId: string | null): string => {
      if (!teamId) return "미배정";
      const team = teams.find((t) => t.id === teamId);
      if (!team) return "미배정";
      if (team.parentId) {
        const parent = teams.find((t) => t.id === team.parentId);
        return parent ? `${parent.name} · ${team.name}` : team.name;
      }
      return team.name;
    },
    [teams],
  );

  const people: Person[] = React.useMemo(
    () =>
      state.data.map((u) => {
        const team = teams.find((t) => t.id === u.teamId);
        return {
          id: u.uid,
          name: u.name,
          role: u.position,
          teamId: u.teamId,
          dept: deptOf(u.teamId),
          team: team?.name ?? deptOf(u.teamId),
          email: u.email,
          ext: u.extensionNumber ?? "",
          mobile: u.phone,
          status: u.presence ?? "online",
          boss: u.managerId,
          tags: u.tasks ?? [],
          placeholder: u.status === "PLACEHOLDER",
        };
      }),
    [state.data, teams, deptOf],
  );

  const addPerson = React.useCallback(async (input: PersonInput) => {
    if (!isFirebaseConfigured) return;
    const id = `placeholder-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const payload: UserDoc = {
      uid: id,
      email: input.email,
      name: input.name,
      teamId: input.teamId,
      managerId: input.boss,
      position: input.role,
      employeeId: "",
      joinedAt: new Date(),
      phone: input.mobile,
      extensionNumber: input.ext || null,
      tasks: input.tags,
      presence: input.status,
      role: "MEMBER",
      status: "PLACEHOLDER",
      createdAt: serverTimestamp() as unknown as UserDoc["createdAt"],
      updatedAt: serverTimestamp() as unknown as UserDoc["updatedAt"],
    };
    await setDoc(doc(firebaseDb(), COL.users, id), payload);
    return id;
  }, []);

  const updatePerson = React.useCallback(
    async (id: string, patch: Partial<PersonInput>) => {
      if (!isFirebaseConfigured) return;
      const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.name !== undefined) data.name = patch.name;
      if (patch.role !== undefined) data.position = patch.role;
      if (patch.teamId !== undefined) data.teamId = patch.teamId;
      if (patch.email !== undefined) data.email = patch.email;
      if (patch.ext !== undefined) data.extensionNumber = patch.ext || null;
      if (patch.mobile !== undefined) data.phone = patch.mobile;
      if (patch.status !== undefined) data.presence = patch.status;
      if (patch.boss !== undefined) data.managerId = patch.boss;
      if (patch.tags !== undefined) data.tasks = patch.tags;
      await updateDoc(doc(firebaseDb(), COL.users, id), data);
    },
    [],
  );

  const removePerson = React.useCallback(async (id: string) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(firebaseDb(), COL.users, id));
  }, []);

  return {
    people,
    loading: state.loading,
    source: state.source,
    addPerson,
    updatePerson,
    removePerson,
  };
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
            date: localDateStr(),
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

  const balance = calculateLeaveBalance(data);

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

/**
 * userSecrets/{uid}를 본인 세션에서만 구독합니다 — 비밀키를 users 문서
 * 바깥에 두는 것 자체가 이번 수정의 핵심이라, 다른 훅과 달리 여기서는
 * uid가 바로 request.auth.uid(본인)일 때만 구독을 엽니다.
 */
function useTwoFactorSecrets(uid: string | null) {
  const [secrets, setSecrets] = React.useState<UserSecretsDoc | null>(null);

  React.useEffect(() => {
    if (!isFirebaseConfigured || !uid) return;
    const unsub = onSnapshot(
      doc(firebaseDb(), COL.userSecrets, uid),
      (snap) => setSecrets(snap.exists() ? (snap.data() as UserSecretsDoc) : null),
      () => setSecrets(null),
    );
    return () => {
      unsub();
      setSecrets(null);
    };
  }, [uid]);

  return secrets;
}

export function useTwoFactor() {
  const { authUser, profile } = useAuthUser();
  const uid = authUser?.uid ?? null;
  const secrets = useTwoFactorSecrets(uid);
  const secret = secrets?.secret ?? null;
  const backupHashes = secrets?.backupCodeHashes ?? [];
  const backupCount = backupHashes.length;
  const enabled = !!profile?.gwSettings?.twoFA && !!secret;

  /**
   * QR 스캔 후 코드 확인까지 끝난 시크릿을 등록하고 백업 코드를 발급합니다.
   * users/{uid}(켜짐 여부만) · userSecrets/{uid}(실제 비밀값) 두 문서를
   * 배치로 함께 씁니다 — 중간에 하나만 반영돼 "켜짐인데 비밀키가 없는"
   * 상태가 되는 것을 방지합니다.
   */
  const enroll = React.useCallback(
    async (secretToSave: string, backupCodes: string[]) => {
      if (!isFirebaseConfigured || !authUser) return;
      const hashes = await Promise.all(backupCodes.map(hashBackupCode));
      const batch = writeBatch(firebaseDb());
      batch.update(doc(firebaseDb(), COL.users, authUser.uid), {
        "gwSettings.twoFA": true,
        updatedAt: new Date(),
      });
      batch.set(doc(firebaseDb(), COL.userSecrets, authUser.uid), {
        secret: secretToSave,
        backupCodeHashes: hashes,
      } satisfies UserSecretsDoc);
      await batch.commit();
    },
    [authUser],
  );

  const disable = React.useCallback(async () => {
    if (!isFirebaseConfigured || !authUser) return;
    const batch = writeBatch(firebaseDb());
    batch.update(doc(firebaseDb(), COL.users, authUser.uid), {
      "gwSettings.twoFA": false,
      updatedAt: new Date(),
    });
    batch.delete(doc(firebaseDb(), COL.userSecrets, authUser.uid));
    await batch.commit();
    clearTwoFactorVerified(authUser.uid);
  }, [authUser]);

  /** 기존 백업 코드를 모두 폐기하고 새 8개를 발급합니다. */
  const regenerateBackupCodes = React.useCallback(async (): Promise<
    string[] | null
  > => {
    if (!isFirebaseConfigured || !authUser || !secret) return null;
    const codes = generateBackupCodes();
    const hashes = await Promise.all(codes.map(hashBackupCode));
    await updateDoc(doc(firebaseDb(), COL.userSecrets, authUser.uid), {
      backupCodeHashes: hashes,
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
/*  사내 메신저 (채팅)                                                  */
/* ------------------------------------------------------------------ */

export interface ChatSummary {
  id: string;
  type: "dm" | "group";
  name: string;
  memberIds: string[];
  memberNames: Record<string, string>;
  readAt: Record<string, number>;
  /** dm 전용 — 상대방 uid */
  otherUid: string | null;
  lastMessage: string;
  lastMessageAt: number;
  lastMessageSenderId: string | null;
  unread: boolean;
}

function chatDisplayName(c: ChatDoc, meUid: string): { name: string; otherUid: string | null } {
  if (c.type === "group") {
    if (c.name?.trim()) return { name: c.name.trim(), otherUid: null };
    const others = c.memberIds.filter((id) => id !== meUid).map((id) => c.memberNames?.[id] ?? "");
    return { name: others.filter(Boolean).join(", ") || "그룹 채팅", otherUid: null };
  }
  const otherUid = c.memberIds.find((id) => id !== meUid) ?? null;
  return { name: (otherUid && c.memberNames?.[otherUid]) || "알 수 없음", otherUid };
}

/** 내가 속한 모든 대화방 — 실시간, 최근 메시지순 정렬 */
export function useChats() {
  const { uid } = useCurrentUser();
  const [raw, setRaw] = React.useState<ChatDoc[]>([]);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);
  // onSnapshot의 에러 콜백도 loading을 false로 내리므로(스피너를 영원히
  // 돌리지 않기 위해), loading===false 만으로는 "진짜 스냅샷을 받았다"를
  // 보장하지 못합니다. 실제 데이터 도착 여부를 구분해야 하는 소비자(예:
  // ChatNotifier)를 위해 별도로 추적합니다.
  const [hasSynced, setHasSynced] = React.useState(false);

  React.useEffect(() => {
    if (!isFirebaseConfigured || !uid) return;
    const q = query(
      collection(firebaseDb(), COL.chats),
      where("memberIds", "array-contains", uid),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRaw(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatDoc));
        setLoading(false);
        setHasSynced(true);
      },
      (err) => {
        console.error("[useChats] onSnapshot error", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  const chats: ChatSummary[] = React.useMemo(() => {
    if (!uid) return [];
    return raw
      .map((c) => {
        const { name, otherUid } = chatDisplayName(c, uid);
        const myReadAt = c.readAt?.[uid] ?? 0;
        const lastMessageAt = c.lastMessageAt ?? 0;
        return {
          id: c.id,
          type: c.type,
          name,
          memberIds: c.memberIds,
          memberNames: c.memberNames ?? {},
          readAt: c.readAt ?? {},
          otherUid,
          lastMessage: c.lastMessage ?? "",
          lastMessageAt,
          lastMessageSenderId: c.lastMessageSenderId ?? null,
          unread: lastMessageAt > myReadAt && c.lastMessageSenderId !== uid,
        };
      })
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }, [raw, uid]);

  const totalUnread = chats.filter((c) => c.unread).length;

  return { chats, loading, hasSynced, totalUnread, myUid: uid };
}

/** 조직도 "메시지" 버튼 — 상대와의 1:1 방을 찾거나 없으면 만들고 id를 반환 */
export async function ensureDirectChat(
  me: { uid: string; name: string },
  other: { uid: string; name: string },
): Promise<string> {
  const id = dmChatId(me.uid, other.uid);
  if (!isFirebaseConfigured) return id;
  const ref = doc(firebaseDb(), COL.chats, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const payload: Omit<ChatDoc, "id"> = {
      type: "dm",
      memberIds: [me.uid, other.uid],
      memberNames: { [me.uid]: me.name, [other.uid]: other.name },
      lastMessage: "",
      lastMessageAt: 0,
      lastMessageSenderId: null,
      readAt: { [me.uid]: Date.now() },
      createdAt: Date.now(),
      createdBy: me.uid,
    };
    await setDoc(ref, payload);
  }
  return id;
}

/** 그룹 채팅 생성 — 참여자 2인 이상(본인 제외) */
export async function createGroupChat(
  me: { uid: string; name: string },
  members: { uid: string; name: string }[],
  groupName: string,
): Promise<string> {
  if (!isFirebaseConfigured) throw new Error("Firebase 미설정");
  const ref = doc(collection(firebaseDb(), COL.chats));
  const memberIds = Array.from(new Set([me.uid, ...members.map((m) => m.uid)]));
  const memberNames: Record<string, string> = { [me.uid]: me.name };
  members.forEach((m) => {
    memberNames[m.uid] = m.name;
  });
  const payload: Omit<ChatDoc, "id"> = {
    type: "group",
    memberIds,
    memberNames,
    name: groupName.trim(),
    lastMessage: "",
    lastMessageAt: 0,
    lastMessageSenderId: null,
    readAt: { [me.uid]: Date.now() },
    createdAt: Date.now(),
    createdBy: me.uid,
  };
  await setDoc(ref, payload);
  return ref.id;
}

/** 대화방 하나의 메시지 — 실시간 구독 + 낙관적 전송(텍스트/파일) */
export function useChatMessages(chatId: string | null) {
  const { uid, name } = useCurrentUser();
  const [data, setData] = React.useState<ChatMessageDoc[]>([]);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);
  const [added, setAdded] = React.useState<ChatMessageDoc[]>([]);

  // 대화방을 옮길 때 이전 방의 낙관적(optimistic) 메시지가 새 방에 섞여
  // 보이지 않도록 렌더 중에 초기화합니다(리액트가 권장하는 "prop 변화에
  // 따라 state 조정" 패턴 — effect 안에서 동기 setState 하지 않습니다).
  const [seenChatId, setSeenChatId] = React.useState(chatId);
  if (chatId !== seenChatId) {
    setSeenChatId(chatId);
    setAdded([]);
  }

  React.useEffect(() => {
    if (!isFirebaseConfigured || !chatId) return;
    const q = query(
      collection(firebaseDb(), chatMessagesPath(chatId)),
      orderBy("createdAt"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessageDoc));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [chatId]);

  const messages = React.useMemo(() => {
    const extra = added.filter((a) => !data.some((d) => d.id === a.id));
    return [...data, ...extra].sort((a, b) => a.createdAt - b.createdAt);
  }, [data, added]);

  const bumpChat = React.useCallback(
    async (preview: string, at: number) => {
      if (!chatId || !uid) return;
      await updateDoc(doc(firebaseDb(), COL.chats, chatId), {
        lastMessage: preview,
        lastMessageAt: at,
        lastMessageSenderId: uid,
        [`readAt.${uid}`]: at,
      }).catch(() => {});
    },
    [chatId, uid],
  );

  const sendText = React.useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !chatId || !uid) return;
      // Date.now()를 id로 쓰면 텍스트/파일을 거의 동시에 보낼 때 같은 id가
      // 나와 먼저 보낸 메시지가 setDoc으로 조용히 덮어써질 수 있어
      // randomUUID로 충돌 없는 id를 씁니다.
      const id = crypto.randomUUID();
      const now = Date.now();
      const payload: Omit<ChatMessageDoc, "id"> = {
        chatId,
        senderId: uid,
        senderName: name,
        type: "text",
        text: body,
        createdAt: now,
      };
      setAdded((p) => [...p, { id, ...payload }]);
      if (!isFirebaseConfigured) return;
      await setDoc(doc(firebaseDb(), chatMessagesPath(chatId), id), payload);
      await bumpChat(body.length > 80 ? `${body.slice(0, 80)}…` : body, now);
    },
    [chatId, uid, name, bumpChat],
  );

  const sendFile = React.useCallback(
    async (file: File) => {
      if (!chatId || !uid || !isFirebaseConfigured) return;
      // storage.rules가 파일당 20MB 초과 업로드를 거부하므로, 그 전에
      // 먼저 걸러 불필요한 업로드 시도와 모호한 실패를 막습니다.
      if (file.size > CHAT_FILE_MAX_BYTES) {
        throw new Error(
          `파일이 너무 큽니다. ${CHAT_FILE_MAX_MB}MB 이하 파일만 보낼 수 있어요.`,
        );
      }
      const id = crypto.randomUUID();
      // file.name을 그대로 Storage 경로에 이어붙이면 "/" 등이 섞여 있을 때
      // chats/{chatId}/ 밑에 예상 못한 하위 경로가 생기고, storage.rules의
      // {fileName} 와일드카드(단일 세그먼트)와 어긋나 업로드가 조용히
      // 거부됩니다 — 경로에는 안전한 이름만 쓰고, 원본 파일명은 표시/다운로드용
      // fileName 필드에 그대로 보존합니다.
      const safeName = file.name.replace(/[/\\?%*:|"<>]/g, "_");
      const path = `chats/${chatId}/${id}-${safeName}`;
      const ref = storageRef(firebaseStorage(), path);
      const snap = await uploadBytes(ref, file);
      const url = await getDownloadURL(snap.ref);
      const isImage = file.type.startsWith("image/");
      const now = Date.now();
      const payload: Omit<ChatMessageDoc, "id"> = {
        chatId,
        senderId: uid,
        senderName: name,
        type: isImage ? "image" : "file",
        fileUrl: url,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        createdAt: now,
      };
      setAdded((p) => [...p, { id, ...payload }]);
      await setDoc(doc(firebaseDb(), chatMessagesPath(chatId), id), payload);
      await bumpChat(isImage ? "사진을 보냈습니다" : `파일 · ${file.name}`, now);
    },
    [chatId, uid, name, bumpChat],
  );

  const markRead = React.useCallback(() => {
    if (!chatId || !uid || !isFirebaseConfigured) return;
    updateDoc(doc(firebaseDb(), COL.chats, chatId), {
      [`readAt.${uid}`]: Date.now(),
    }).catch(() => {});
  }, [chatId, uid]);

  return { messages, loading, sendText, sendFile, markRead, myUid: uid };
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
  const me = useCurrentUser();

  return React.useMemo(() => {
    const byRecency = <T extends { _s: number }>(a: T, b: T) => a._s - b._s;

    // bucket === "pending"만 보면 회사 전체 상신 문서가 다 내 알림으로
    // 뜹니다 — isPendingApprover로 결재선의 현재 차례가 나인 문서만 골라야
    // /approval, /my 등 다른 화면의 "결재 대기" 집계와도 건수가 맞습니다.
    const ap = approvals
      .filter((a) => a.bucket === "pending" && isPendingApprover(a, me))
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
      .filter((n) => isNoticeUnread(n, me.uid))
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
  }, [approvals, notices, leaves, me]);
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
