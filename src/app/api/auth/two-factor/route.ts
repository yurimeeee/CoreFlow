import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { firebaseAdmin } from "@/lib/firebaseAdmin";
import {
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  matchTotpStep,
} from "@/lib/totp";
import type { UserDoc, UserSecretsDoc } from "@/types/user";

/**
 * 2단계 인증 서버 라우트.
 *
 * 예전엔 TOTP 비밀키를 본인 클라이언트가 읽어 브라우저에서 검증하고, 통과
 * 여부를 sessionStorage 플래그로만 기억했습니다. 보안 규칙은 2FA를 전혀 보지
 * 않아서, 비밀번호만 알면 Firestore SDK로 데이터를 바로 읽거나 userSecrets 의
 * 비밀키를 읽어 코드를 만들고, 덮어써 2FA를 꺼버릴 수 있었습니다.
 *
 * 이제 비밀키는 서버만 읽고(userSecrets: 클라이언트 접근 불가), 코드가 맞으면
 * 서버가 twoFactorId 클레임이 든 커스텀 토큰을 발급합니다. 클라이언트가 그
 * 토큰으로 다시 로그인하면 이후 ID 토큰마다 클레임이 붙고, firestore.rules 의
 * isMember()가 users/{uid}.twoFactorId 와 같은지 확인합니다.
 *
 * POST { action, code? }
 * - status          켜짐 여부 · 이 세션이 통과했는지 · 남은 백업 코드 수
 * - verify          로그인 2단계 — 코드(TOTP 또는 백업)를 확인하고 토큰 발급
 * - enrollStart     새 비밀키를 만들어 QR용으로 돌려줌 (꺼져 있을 때만)
 * - enrollConfirm   앱 코드를 확인하고 백업 코드 + 토큰 발급
 * - enrollActivate  그 토큰으로 다시 로그인한 뒤 호출 — 실제로 켬
 * - disable         통과한 세션 + 코드 확인 후 끔
 * - regenerateBackupCodes  통과한 세션에서 백업 코드 재발급
 *
 * 켜는 걸 enrollConfirm/enrollActivate 두 단계로 나눈 이유: users.twoFactorId
 * 를 먼저 쓰면 클라이언트가 새 토큰으로 바꾸기 전 순간에 규칙·AuthGuard 가
 * "2FA 미통과"로 보고 사용자를 로그인 화면으로 튕겨냅니다.
 */

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;
const ENROLL_TTL_MS = 10 * 60 * 1000;

type Action =
  | "status"
  | "verify"
  | "enrollStart"
  | "enrollConfirm"
  | "enrollActivate"
  | "disable"
  | "regenerateBackupCodes";

const ACTIONS: Action[] = [
  "status",
  "verify",
  "enrollStart",
  "enrollConfirm",
  "enrollActivate",
  "disable",
  "regenerateBackupCodes",
];

function fail(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

class CodeError extends Error {
  constructor(
    readonly code: "invalid_code" | "locked" | "not_enrolled",
    readonly retryAfterMs?: number,
  ) {
    super(code);
  }
}

function codeErrorResponse(e: CodeError) {
  if (e.code === "locked") {
    return fail("locked", 429, { retryAfterSec: Math.ceil((e.retryAfterMs ?? LOCK_MS) / 1000) });
  }
  return fail(e.code, e.code === "not_enrolled" ? 409 : 400);
}

/**
 * 코드를 트랜잭션 안에서 확인합니다 — 잠금·실패 횟수·마지막 카운터·백업 코드
 * 폐기를 한 번에 반영해야 동시 요청으로 같은 코드를 두 번 쓰거나 실패 횟수를
 * 우회할 수 없습니다. 6자리 숫자는 TOTP, 그 외는 백업 코드로 봅니다.
 * secretField 는 확인할 비밀키(등록 중이면 pendingSecret), onSuccess 는
 * 성공했을 때 같은 쓰기에 함께 반영할 필드입니다.
 */
async function checkCode(
  db: FirebaseFirestore.Firestore,
  ref: DocumentReference,
  code: string,
  secretField: "secret" | "pendingSecret",
  onSuccess?: (s: UserSecretsDoc) => Partial<UserSecretsDoc>,
) {
  const clean = code.trim().replace(/\s+/g, "");
  const now = Date.now();
  const isTotp = /^\d{6}$/.test(clean);
  const backupHash = isTotp ? null : await hashBackupCode(clean);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const s = (snap.data() ?? {}) as UserSecretsDoc;
    const secret = s[secretField];
    if (!secret) throw new CodeError("not_enrolled");
    if (s.lockedUntil && s.lockedUntil > now) {
      return { ok: false as const, lockedFor: s.lockedUntil - now };
    }

    let ok = false;
    const update: Record<string, unknown> = {};
    if (isTotp) {
      const step = await matchTotpStep(secret, clean, 1, now);
      // 이미 받은 카운터 이하의 코드는 거부 — 화면 너머로 본 코드 재사용 방지
      if (step !== null && step > (s.lastStep ?? -1)) {
        ok = true;
        update.lastStep = step;
      }
    } else if (backupHash && secretField === "secret") {
      const hashes = s.backupCodeHashes ?? [];
      if (hashes.includes(backupHash)) {
        ok = true;
        update.backupCodeHashes = hashes.filter((h) => h !== backupHash);
      }
    }

    if (!ok) {
      const fails = (s.failCount ?? 0) + 1;
      tx.set(
        ref,
        fails >= MAX_FAILS
          ? { failCount: 0, lockedUntil: now + LOCK_MS }
          : { failCount: fails },
        { merge: true },
      );
      return { ok: false as const, lockedFor: fails >= MAX_FAILS ? LOCK_MS : 0 };
    }

    tx.set(
      ref,
      { ...update, ...onSuccess?.(s), failCount: 0, lockedUntil: 0 },
      { merge: true },
    );
    return { ok: true as const };
  });

  if (!result.ok) {
    throw result.lockedFor > 0
      ? new CodeError("locked", result.lockedFor)
      : new CodeError("invalid_code");
  }
}

async function hashAll(codes: string[]) {
  return Promise.all(codes.map(hashBackupCode));
}

export async function POST(req: Request) {
  const admin = firebaseAdmin();
  if (!admin) return fail("not_configured", 503);

  const idToken = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!idToken) return fail("unauthenticated", 401);
  let decoded: DecodedIdToken;
  try {
    decoded = await admin.auth.verifyIdToken(idToken);
  } catch {
    return fail("unauthenticated", 401);
  }

  let body: { action?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }
  const action = body.action as Action;
  if (!ACTIONS.includes(action)) return fail("unsupported_action", 400);
  const code = typeof body.code === "string" ? body.code.slice(0, 32) : "";

  const { db, auth } = admin;
  const uid = decoded.uid;
  const userRef = db.doc(`users/${uid}`);
  const secretsRef = db.doc(`userSecrets/${uid}`);

  const [userSnap, secretsSnap] = await Promise.all([userRef.get(), secretsRef.get()]);
  if (!userSnap.exists) return fail("no_profile", 403);
  const user = userSnap.data() as UserDoc;
  const secrets = (secretsSnap.data() ?? {}) as UserSecretsDoc;

  let twoFactorId = user.twoFactorId ?? null;
  // 서버 검증으로 바꾸기 전에 2FA를 켠 계정 — 비밀키가 남아 있으면 그대로
  // 이어서 쓰도록 등록 id 를 붙여 줍니다(비밀키가 없으면 꺼진 것으로 봄).
  if (!twoFactorId && user.gwSettings?.twoFA && secrets.secret) {
    twoFactorId = randomUUID();
    await userRef.update({ twoFactorId, updatedAt: FieldValue.serverTimestamp() });
  }
  const enabled = !!twoFactorId;
  const satisfied = enabled && decoded.twoFactorId === twoFactorId;
  const issue = (id: string) => auth.createCustomToken(uid, { twoFactorId: id });

  try {
    switch (action) {
      case "status":
        return NextResponse.json({
          ok: true,
          enabled,
          satisfied,
          backupCount: satisfied ? (secrets.backupCodeHashes?.length ?? 0) : 0,
        });

      case "verify": {
        if (!enabled) return fail("not_enrolled", 409);
        await checkCode(db, secretsRef, code, "secret");
        return NextResponse.json({ ok: true, token: await issue(twoFactorId!), twoFactorId });
      }

      case "enrollStart": {
        if (enabled) return fail("already_enabled", 409);
        const secret = generateTotpSecret();
        await secretsRef.set({
          pendingSecret: secret,
          pendingAt: Date.now(),
          pendingId: null,
          failCount: 0,
          lockedUntil: 0,
        } satisfies UserSecretsDoc);
        return NextResponse.json({ ok: true, secret });
      }

      case "enrollConfirm": {
        if (enabled) return fail("already_enabled", 409);
        if (!secrets.pendingSecret || Date.now() - (secrets.pendingAt ?? 0) > ENROLL_TTL_MS) {
          return fail("enroll_expired", 409);
        }
        const backupCodes = generateBackupCodes();
        const hashes = await hashAll(backupCodes);
        const newId = randomUUID();
        await checkCode(db, secretsRef, code, "pendingSecret", (s) => ({
          secret: s.pendingSecret!,
          backupCodeHashes: hashes,
          pendingSecret: null,
          pendingAt: null,
          pendingId: newId,
        }));
        return NextResponse.json({
          ok: true,
          backupCodes,
          token: await issue(newId),
          twoFactorId: newId,
        });
      }

      case "enrollActivate": {
        if (enabled) return fail("already_enabled", 409);
        if (!secrets.pendingId || decoded.twoFactorId !== secrets.pendingId) {
          return fail("not_verified", 403);
        }
        const batch = db.batch();
        batch.update(userRef, {
          twoFactorId: secrets.pendingId,
          "gwSettings.twoFA": true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        batch.update(secretsRef, { pendingId: null });
        await batch.commit();
        return NextResponse.json({ ok: true });
      }

      case "disable": {
        if (!satisfied) return fail("not_verified", 403);
        await checkCode(db, secretsRef, code, "secret");
        const batch = db.batch();
        batch.update(userRef, {
          twoFactorId: null,
          "gwSettings.twoFA": false,
          updatedAt: FieldValue.serverTimestamp(),
        });
        batch.delete(secretsRef);
        await batch.commit();
        return NextResponse.json({ ok: true });
      }

      case "regenerateBackupCodes": {
        if (!satisfied) return fail("not_verified", 403);
        const backupCodes = generateBackupCodes();
        await secretsRef.update({ backupCodeHashes: await hashAll(backupCodes) });
        return NextResponse.json({ ok: true, backupCodes });
      }
    }
  } catch (e) {
    if (e instanceof CodeError) return codeErrorResponse(e);
    return fail("internal", 500);
  }
}
