import { NextResponse } from "next/server";
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { firebaseAdmin } from "@/lib/firebaseAdmin";
import type { ApprovalDoc, TaskDoc } from "@/lib/groupware/firestore";
import { reassignApproval, reassignTask, type Successor } from "@/lib/offboarding";
import type { UserDoc } from "@/types/user";

/**
 * 퇴사 처리 / 복직 — 관리자 전용.
 *
 * 계정 차단은 클라이언트가 할 수 없어 서버가 맡습니다. users 상태만
 * RESIGNED 로 바꾸면 보안 규칙(isMember)이 데이터 접근은 막지만, Firebase
 * Auth 계정은 살아 있어 로그인과 서버 라우트 호출이 계속 됐습니다. 그래서
 * Auth 계정을 비활성화하고 리프레시 토큰을 폐기합니다.
 *
 * 퇴사자가 맡던 일은 후임자에게 넘깁니다.
 * - 진행 중 결재에서 아직 처리하지 않은 결재 단계 (임시저장 포함)
 * - 담당 중인 미완료 Task
 * - 퇴사자를 직속 상사로 둔 구성원
 * 넘길 게 있으면 후임자를 반드시 지정해야 합니다 — 그렇지 않으면 결재가
 * 아무도 처리할 수 없는 사람 차례에서 멈춥니다.
 *
 * 순서: 상태 변경(+감사 로그) → Auth 차단 → 인계. 인계가 중간에 실패해도
 * 접근은 이미 막혀 있고, 같은 요청을 다시 보내면 남은 인계를 이어서 합니다.
 *
 * action: "preview"(인계 건수만) | "offboard" | "reinstate"
 */

type Action = "preview" | "offboard" | "reinstate";

/** TASK_COLUMNS 의 마지막 컬럼 — firestore.ts 는 시드 데이터까지 끌고 와서 값으로 import 하지 않습니다 */
const DONE_COL = "done";
const BATCH_LIMIT = 400;

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isAdminUser(u: UserDoc | undefined) {
  return u?.status === "ACTIVE" && (u.role === "ADMIN" || u.role === "SUPER_ADMIN");
}

interface Handover {
  approvals: { ref: DocumentReference; patch: Record<string, unknown> }[];
  /** 후임자가 기안자라 맡길 수 없는 결재 문서 번호 */
  skipped: string[];
  tasks: { ref: DocumentReference; patch: Record<string, unknown> }[];
  reports: { ref: DocumentReference; patch: Record<string, unknown> }[];
}

function counts(h: Handover) {
  return {
    approvals: h.approvals.length,
    tasks: h.tasks.length,
    reports: h.reports.length,
    skippedApprovals: h.skipped,
  };
}

/**
 * 넘길 일 목록. 후임자가 없으면(preview) 건수 계산용 임시 후임자로
 * 계산합니다. approverUids 가 없는 구 문서는 currentApproverUid 로 찾습니다.
 */
async function planHandover(db: Firestore, target: UserDoc, to: Successor | null): Promise<Handover> {
  const from = target.uid;
  const who: Successor = to ?? { uid: "", name: "", position: "", teamId: null };
  const [byList, byCurrent, tasks, reports] = await Promise.all([
    db.collection("approvals").where("approverUids", "array-contains", from).get(),
    db.collection("approvals").where("currentApproverUid", "==", from).get(),
    db.collection("tasks").where("assigneeId", "==", from).get(),
    db.collection("users").where("managerId", "==", from).get(),
  ]);

  const h: Handover = { approvals: [], skipped: [], tasks: [], reports: [] };
  const seen = new Set<string>();
  for (const d of [...byList.docs, ...byCurrent.docs]) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const patch = reassignApproval(d.data() as ApprovalDoc, from, who);
    if (patch === "self") h.skipped.push(d.id);
    else if (patch) h.approvals.push({ ref: d.ref, patch: { ...patch } });
  }
  for (const d of tasks.docs) {
    const patch = reassignTask(d.data() as TaskDoc, from, who, DONE_COL);
    if (patch) h.tasks.push({ ref: d.ref, patch });
  }
  for (const d of reports.docs) {
    if (d.id === from) continue;
    // 후임자가 퇴사자의 직속 부하였다면 퇴사자의 상사 밑으로 올립니다
    const managerId = d.id === who.uid ? (target.managerId ?? null) : who.uid;
    h.reports.push({ ref: d.ref, patch: { managerId, updatedAt: FieldValue.serverTimestamp() } });
  }
  return h;
}

async function commitHandover(db: Firestore, h: Handover) {
  const writes = [...h.approvals, ...h.tasks, ...h.reports];
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + BATCH_LIMIT)) batch.update(w.ref, w.patch);
    await batch.commit();
  }
}

/** Auth 계정 차단/해제 — 가계정처럼 Auth 계정이 없으면 건너뜁니다 */
async function setAuthDisabled(auth: Auth, uid: string, disabled: boolean) {
  try {
    await auth.updateUser(uid, { disabled });
    if (disabled) await auth.revokeRefreshTokens(uid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
  }
}

export async function POST(req: Request) {
  const admin = firebaseAdmin();
  if (!admin) return fail("not_configured", 503);

  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fail("unauthenticated", 401);
  let callerUid: string;
  let tokenTwoFactorId: unknown;
  try {
    const decoded = await admin.auth.verifyIdToken(token, true);
    callerUid = decoded.uid;
    tokenTwoFactorId = decoded.twoFactorId;
  } catch {
    return fail("unauthenticated", 401);
  }

  let body: { action?: string; uid?: string; successorUid?: string | null };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }
  const action = body.action as Action;
  if (!["preview", "offboard", "reinstate"].includes(action) || typeof body.uid !== "string" || !body.uid) {
    return fail("invalid_body", 400);
  }

  const db = admin.db;
  const getUser = async (uid: string) =>
    (await db.doc(`users/${uid}`).get()).data() as UserDoc | undefined;

  // firestore.rules 의 isAdmin() 과 같은 기준 (2FA 통과 포함)
  const me = await getUser(callerUid);
  if (!isAdminUser(me)) return fail("forbidden", 403);
  if (me!.twoFactorId && tokenTwoFactorId !== me!.twoFactorId) return fail("forbidden", 403);

  const target = await getUser(body.uid);
  if (!target) return fail("not_found", 404);
  if (target.uid === callerUid) return fail("self", 400);
  if (target.status === "PLACEHOLDER" || target.status === "INVITED") return fail("not_account", 400);
  // 최고 관리자는 최고 관리자만 퇴사 처리할 수 있습니다
  if (target.role === "SUPER_ADMIN" && me!.role !== "SUPER_ADMIN") return fail("forbidden", 403);
  const userRef = db.doc(`users/${target.uid}`);
  const now = FieldValue.serverTimestamp();

  if (action === "reinstate") {
    if (target.status !== "RESIGNED") return fail("not_resigned", 400);
    await setAuthDisabled(admin.auth, target.uid, false);
    const batch = db.batch();
    batch.update(userRef, { status: "ACTIVE", resignedAt: null, resignedBy: null, updatedAt: now });
    batch.create(db.collection("auditLogs").doc(), {
      actorUid: callerUid,
      action: "user.reinstate",
      targets: [`users/${target.uid}`],
      summary: `"${target.name}" 복직 처리`,
      at: now,
    });
    await batch.commit();
    return NextResponse.json({ ok: true });
  }

  let successor: Successor | null = null;
  if (body.successorUid) {
    const s = await getUser(body.successorUid);
    if (!s || s.status !== "ACTIVE" || s.uid === target.uid) return fail("successor_invalid", 400);
    successor = { uid: s.uid, name: s.name, position: s.position, teamId: s.teamId };
  }

  const plan = await planHandover(db, target, successor);
  const total = plan.approvals.length + plan.tasks.length + plan.reports.length;
  if (action === "preview") return NextResponse.json({ ok: true, counts: counts(plan) });
  if (total > 0 && !successor) return fail("successor_required", 400);

  // 1) 상태 변경 + 감사 로그 — 이 순간부터 보안 규칙이 접근을 막습니다
  const batch = db.batch();
  batch.update(userRef, {
    status: "RESIGNED",
    resignedAt: target.status === "RESIGNED" ? (target.resignedAt ?? now) : now,
    resignedBy: callerUid,
    updatedAt: now,
  });
  batch.create(db.collection("auditLogs").doc(), {
    actorUid: callerUid,
    action: "user.offboard",
    targets: [`users/${target.uid}`, ...[...plan.approvals, ...plan.tasks, ...plan.reports].map((w) => w.ref.path)],
    summary: successor
      ? `"${target.name}" 퇴사 처리 · 후임 ${successor.name} (결재 ${plan.approvals.length}, Task ${plan.tasks.length}, 직속 구성원 ${plan.reports.length})`
      : `"${target.name}" 퇴사 처리`,
    detail: { successorUid: successor?.uid ?? null, ...counts(plan) },
    at: now,
  });
  await batch.commit();

  // 2) 로그인·토큰 갱신 차단
  try {
    await setAuthDisabled(admin.auth, target.uid, true);
  } catch {
    return fail("auth_disable_failed", 500);
  }

  // 3) 인계
  try {
    await commitHandover(db, plan);
  } catch {
    return fail("handover_incomplete", 500);
  }
  return NextResponse.json({ ok: true, counts: counts(plan) });
}
