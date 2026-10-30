import { NextResponse } from "next/server";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/lib/firebaseAdmin";

/**
 * 첫 관리자 부트스트랩.
 *
 * 보안 규칙상 클라이언트는 자기 users 문서를 초대장 없이 만들 수 없고, 초대장은
 * 관리자만 만들 수 있어 빈 프로젝트에선 첫 관리자를 만들 방법이 없었습니다
 * (/admin/seed 가 본인 문서를 SUPER_ADMIN 으로 쓰려다 규칙에 막힘).
 *
 * 서버가 Admin SDK 로 대신 만들되, 두 조건을 모두 만족할 때만 허용합니다.
 * - 호출자의 ID 토큰 이메일 == BOOTSTRAP_ADMIN_EMAIL (서버 환경변수)
 * - 관리자(ADMIN · SUPER_ADMIN) users 문서가 아직 하나도 없음
 * 첫 관리자가 생기면 이 라우트는 영구히 닫힙니다.
 *
 * GET 은 버튼 노출 여부 확인용(가능 여부만), POST 가 실제 생성입니다.
 */

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function caller(req: Request) {
  const admin = firebaseAdmin();
  const allowed = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!admin || !allowed) return { error: fail("not_configured", 503) } as const;

  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { error: fail("unauthenticated", 401) } as const;
  try {
    const decoded = await admin.auth.verifyIdToken(token);
    if (decoded.email?.toLowerCase() !== allowed) {
      return { error: fail("forbidden", 403) } as const;
    }
    return { admin, decoded } as const;
  } catch {
    return { error: fail("unauthenticated", 401) } as const;
  }
}

function adminsQuery(db: Firestore) {
  return db.collection("users").where("role", "in", ["ADMIN", "SUPER_ADMIN"]).limit(1);
}

export async function GET(req: Request) {
  const c = await caller(req);
  if ("error" in c) return c.error;
  const existing = await adminsQuery(c.admin.db).get();
  return NextResponse.json({ ok: true, available: existing.empty });
}

export async function POST(req: Request) {
  const c = await caller(req);
  if ("error" in c) return c.error;
  const { admin, decoded } = c;
  const db = admin.db;
  const meRef = db.collection("users").doc(decoded.uid);

  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(adminsQuery(db));
      if (!existing.empty) throw new Error("already_bootstrapped");
      const me = await tx.get(meRef);
      const email = decoded.email ?? "";
      const now = FieldValue.serverTimestamp();
      tx.set(
        meRef,
        {
          uid: decoded.uid,
          email,
          name: me.get("name") || decoded.name || email.split("@")[0] || "관리자",
          teamId: me.get("teamId") ?? null,
          managerId: null,
          position: me.get("position") || "관리자",
          employeeId: me.get("employeeId") || `CF-${decoded.uid.slice(0, 6).toUpperCase()}`,
          joinedAt: me.get("joinedAt") ?? Timestamp.now(),
          phone: me.get("phone") ?? "",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          createdAt: me.get("createdAt") ?? now,
          updatedAt: now,
        },
        { merge: true },
      );
    });
  } catch (e) {
    if (e instanceof Error && e.message === "already_bootstrapped") {
      return fail("already_bootstrapped", 409);
    }
    return fail("internal", 500);
  }
  return NextResponse.json({ ok: true });
}
