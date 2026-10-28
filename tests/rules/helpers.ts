import { readFileSync } from "node:fs";
import path from "node:path";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

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
