import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/lib/firebaseAdmin";
import {
  buildExportRows,
  dateRange,
  isValidTimeZone,
  toCsv,
  type ExportDay,
  type ExportKind,
  type ExportLeave,
  type ExportPerson,
} from "@/lib/attendanceExport";
import type { UserDoc } from "@/types/user";

/**
 * 근태 CSV 내보내기 — 관리자 전용.
 *
 * 구성원의 출퇴근 기록(attendance/{uid}/days)과 승인된 연차·초과근무
 * (leaves)를 기간·부서로 모아 CSV 로 돌려줍니다. 개인 근태를 한꺼번에
 * 내려받는 일이라 서버가 감사 로그를 직접 남깁니다(내려받기 전에 기록 —
 * 로그를 못 남기면 내려주지 않습니다).
 *
 * body: { start, end: "yyyy-mm-dd", teamId?: string | null, kind: "daily" | "summary", tz }
 * teamId 를 주면 그 팀과 하위 팀 소속만. 퇴사자도 기간 안 기록이 있으면 포함합니다.
 */

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isAdminUser(u: UserDoc | undefined) {
  return u?.status === "ACTIVE" && (u.role === "ADMIN" || u.role === "SUPER_ADMIN");
}

/** 근태 기록이 생길 수 있는 계정 — 가계정·초대·승인 대기는 빠집니다 */
const EXPORT_STATUSES = new Set(["ACTIVE", "SUSPENDED", "RESIGNED"]);

export async function POST(req: Request) {
  const admin = firebaseAdmin();
  if (!admin) return fail("not_configured", 503);

  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fail("unauthenticated", 401);
  let callerUid: string;
  let tokenTwoFactorId: unknown;
  try {
    const decoded = await admin.auth.verifyIdToken(token);
    callerUid = decoded.uid;
    tokenTwoFactorId = decoded.twoFactorId;
  } catch {
    return fail("unauthenticated", 401);
  }

  let body: { start?: unknown; end?: unknown; teamId?: unknown; kind?: unknown; tz?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }
  const kind = body.kind as ExportKind;
  const tz = typeof body.tz === "string" ? body.tz : "";
  const teamId = typeof body.teamId === "string" && body.teamId ? body.teamId : null;
  if ((kind !== "daily" && kind !== "summary") || !isValidTimeZone(tz)) return fail("invalid_body", 400);
  const dates =
    typeof body.start === "string" && typeof body.end === "string" ? dateRange(body.start, body.end) : null;
  if (!dates) return fail("invalid_range", 400);
  const start = dates[0];
  const end = dates[dates.length - 1];

  const db = admin.db;
  // firestore.rules 의 isAdmin() 과 같은 기준 (2FA 통과 포함)
  const me = (await db.doc(`users/${callerUid}`).get()).data() as UserDoc | undefined;
  if (!isAdminUser(me)) return fail("forbidden", 403);
  if (me!.twoFactorId && tokenTwoFactorId !== me!.twoFactorId) return fail("forbidden", 403);

  const [usersSnap, teamsSnap] = await Promise.all([db.collection("users").get(), db.collection("teams").get()]);
  const teams = new Map(
    teamsSnap.docs.map((d) => [d.id, d.data() as { name: string; parentId: string | null }]),
  );
  if (teamId && !teams.has(teamId)) return fail("invalid_team", 400);
  const deptOf = (id: string | null) => {
    const t = id ? teams.get(id) : undefined;
    if (!t) return "미배정";
    const parent = t.parentId ? teams.get(t.parentId) : undefined;
    return parent ? `${parent.name} · ${t.name}` : t.name;
  };
  const inTeam = (id: string | null) => !teamId || id === teamId || (!!id && teams.get(id)?.parentId === teamId);

  const people: ExportPerson[] = usersSnap.docs
    .map((d) => ({ ...(d.data() as UserDoc), uid: d.id }))
    .filter((u) => EXPORT_STATUSES.has(u.status) && inTeam(u.teamId))
    .map((u) => ({
      uid: u.uid,
      name: u.name ?? "",
      employeeId: u.employeeId ?? "",
      dept: deptOf(u.teamId),
      position: u.position ?? "",
      resigned: u.status === "RESIGNED",
    }))
    .sort((a, b) => a.dept.localeCompare(b.dept, "ko") || a.name.localeCompare(b.name, "ko"));

  const uids = new Set(people.map((p) => p.uid));
  const [daySnaps, leavesSnap] = await Promise.all([
    Promise.all(
      people.map((p) =>
        db.collection(`attendance/${p.uid}/days`).where("date", ">=", start).where("date", "<=", end).get(),
      ),
    ),
    // end >= start 인 것만 받고, 시작일·상태는 메모리에서 거릅니다(복합 색인 없이)
    db.collection("leaves").where("end", ">=", start).get(),
  ]);

  const ms = (t: unknown) =>
    t && typeof (t as { toMillis?: unknown }).toMillis === "function" ? (t as { toMillis(): number }).toMillis() : null;
  const daysByUid = new Map<string, ExportDay[]>(
    people.map((p, i) => [
      p.uid,
      daySnaps[i].docs.map((d) => {
        const x = d.data();
        return { date: String(x.date ?? d.id), inMs: ms(x.inTs), outMs: ms(x.outTs) };
      }),
    ]),
  );
  const leaves: ExportLeave[] = leavesSnap.docs
    .map((d) => d.data() as ExportLeave & { status: string })
    .filter((l) => l.status === "승인" && uids.has(l.uid) && l.start <= end);

  // 퇴사자는 기간 안에 기록이 있을 때만
  const listed = people.filter(
    (p) => !p.resigned || (daysByUid.get(p.uid)?.length ?? 0) > 0 || leaves.some((l) => l.uid === p.uid),
  );

  const csv = toCsv(buildExportRows(kind, listed, daysByUid, leaves, dates, tz));
  const teamLabel = teamId ? deptOf(teamId) : "전체";
  const kindLabel = kind === "daily" ? "일별" : "요약";

  await db.collection("auditLogs").add({
    actorUid: callerUid,
    action: "attendance.export",
    targets: listed.map((p) => `attendance/${p.uid}`),
    summary: `근태 CSV 내보내기 · ${start} ~ ${end} · ${teamLabel} · ${kindLabel} · ${listed.length}명`,
    detail: { start, end, teamId, kind, people: listed.length },
    at: FieldValue.serverTimestamp(),
  });

  const filename = `근태_${kindLabel}_${start}_${end}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
