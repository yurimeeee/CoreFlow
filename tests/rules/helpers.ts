import { readFileSync } from "node:fs";
import path from "node:path";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";

export { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";

const root = path.resolve(import.meta.dirname, "../..");

/** emulators:exec 가 FIRESTORE_EMULATOR_HOST 등을 넣어주므로 host 지정 불필요 */
export function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: "demo-coreflow",
    firestore: { rules: readFileSync(path.join(root, "firestore.rules"), "utf8") },
    storage: { rules: readFileSync(path.join(root, "storage.rules"), "utf8") },
  });
}

/** 규칙을 끈 상태로 문서를 미리 깔아둡니다. */
export async function seed(
  env: RulesTestEnvironment,
  docs: Record<string, Record<string, unknown>>,
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [p, data] of Object.entries(docs)) await setDoc(doc(db, p), data);
  });
}

/** ACTIVE 구성원 users 문서 (role 기본 MEMBER) */
export function member(uid: string, role = "MEMBER") {
  return { [`users/${uid}`]: { uid, role, status: "ACTIVE" } };
}

export function members(...uids: string[]) {
  return Object.assign({}, ...uids.map((u) => member(u)));
}

export function db(env: RulesTestEnvironment, uid: string, email?: string) {
  return env.authenticatedContext(uid, email ? { email } : {}).firestore();
}

/**
 * 관리자 전용 쓰기 — src/lib/groupware/audit.ts 의 auditedWrite 처럼 감사 로그와
 * auditCursor 를 같은 배치로 묶어 커밋합니다. log 로 로그 필드를 덮어써 규칙
 * 위반 케이스를 만들 수 있습니다.
 */
export function auditedBatch(
  env: RulesTestEnvironment,
  uid: string,
  targets: string[],
  apply: (b: WriteBatch, d: Firestore) => void,
  log: Record<string, unknown> = {},
) {
  // rules-unit-testing 은 compat 타입을 돌려주지만 실제로는 modular API 와 호환됩니다
  const d = db(env, uid) as unknown as Firestore;
  const b = writeBatch(d);
  const logRef = doc(collection(d, "auditLogs"));
  b.set(logRef, {
    actorUid: uid,
    action: "test",
    targets,
    summary: "test",
    at: serverTimestamp(),
    ...log,
  });
  b.set(doc(d, "auditCursor", uid), { logId: logRef.id });
  apply(b, d);
  return b.commit();
}
