import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, db, members, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

const DAY = 86_400_000;
const ts = (offsetDays: number) => Timestamp.fromMillis(Date.now() + offsetDays * DAY);
/** a1 → dg 위임 (기본: 어제부터 내일까지 = 지금 유효) */
const delegation = (o: Record<string, unknown> = {}) => ({
  delegateUid: "dg",
  from: ts(-1),
  until: ts(1),
  reason: "휴가",
  ...o,
});

const line = [
  { kind: "기안", uid: "au", done: true },
  { kind: "결재", uid: "a1", done: false },
  { kind: "결재", uid: "a2", done: false },
];
const approval = (o: Record<string, unknown> = {}) => ({
  type: "지출",
  title: "T",
  authorUid: "au",
  status: "Waiting",
  bucket: "pending",
  line,
  currentApproverUid: "a1",
  approverUids: ["au", "a1", "a2"],
  approverSeq: ["a1", "a2"],
  step: 0,
  ...o,
});
/** 1단계(a1) 승인 → a2 차례 */
const advance = (o: Record<string, unknown> = {}) => ({
  status: "In Progress",
  line: [line[0], { ...line[1], done: true, state: "승인", proxyUid: "dg" }, line[2]],
  currentApproverUid: "a2",
  step: 1,
  ...o,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env, {
    ...members("au", "a1", "a2", "dg", "x"),
    "users/gone": { uid: "gone", role: "MEMBER", status: "RESIGNED" },
    "approvals/D1": approval(),
  });
});

const write = (uid: string, data: Record<string, unknown>) =>
  setDoc(doc(db(env, uid), "delegations", uid), { ...data, updatedAt: serverTimestamp() });

describe("위임 설정 (delegations/{uid})", () => {
  it("본인 것만, 재직 중인 다른 구성원에게 맡길 수 있다", async () => {
    await assertSucceeds(write("a1", delegation()));
    await assertFails(setDoc(doc(db(env, "x"), "delegations", "a1"), { ...delegation(), updatedAt: serverTimestamp() }));
    await assertFails(write("a1", delegation({ delegateUid: "a1" })));
    await assertFails(write("a1", delegation({ delegateUid: "gone" })));
    await assertFails(write("a1", delegation({ delegateUid: "nobody" })));
  });

  it("기간이 거꾸로이거나, 이미 끝났거나, 91일을 넘으면 거부", async () => {
    await assertFails(write("a1", delegation({ from: ts(2), until: ts(1) })));
    await assertFails(write("a1", delegation({ from: ts(-3), until: ts(-1) })));
    await assertFails(write("a1", delegation({ from: ts(0), until: ts(95) })));
    await assertFails(write("a1", delegation({ extra: true })));
  });

  it("위임한 사람·받은 사람만 읽고, 받은 사람은 지울 수 없다", async () => {
    await seed(env, { "delegations/a1": delegation() });
    await assertSucceeds(getDoc(doc(db(env, "a1"), "delegations", "a1")));
    await assertSucceeds(
      getDocs(query(collection(db(env, "dg"), "delegations"), where("delegateUid", "==", "dg"))),
    );
    await assertFails(getDoc(doc(db(env, "x"), "delegations", "a1")));
    await assertFails(deleteDoc(doc(db(env, "dg"), "delegations", "a1")));
    await assertSucceeds(deleteDoc(doc(db(env, "a1"), "delegations", "a1")));
  });
});

describe("대리 결재", () => {
  it("위임 기간에는 차례인 문서를 열람·조회하고 대신 결재할 수 있다", async () => {
    await seed(env, { "delegations/a1": delegation() });
    const d = db(env, "dg");
    await assertSucceeds(getDoc(doc(d, "approvals", "D1")));
    await assertSucceeds(
      getDocs(query(collection(d, "approvals"), where("currentApproverUid", "==", "a1"))),
    );
    await assertSucceeds(updateDoc(doc(d, "approvals", "D1"), advance({ approverUids: ["au", "a1", "a2", "dg"] })));
    // 처리한 뒤에도 approverUids 로 계속 열람
    await assertSucceeds(getDoc(doc(d, "approvals", "D1")));
  });

  it("위임이 없거나 끝났거나 아직 시작 전이면 거부", async () => {
    await assertFails(updateDoc(doc(db(env, "dg"), "approvals", "D1"), advance()));
    await seed(env, { "delegations/a1": delegation({ from: ts(-3), until: ts(-1) }) });
    await assertFails(getDoc(doc(db(env, "dg"), "approvals", "D1")));
    await seed(env, { "delegations/a1": delegation({ from: ts(1), until: ts(2) }) });
    await assertFails(updateDoc(doc(db(env, "dg"), "approvals", "D1"), advance()));
  });

  it("결재 순서를 건너뛰거나 남을 결재선에 넣을 수 없다", async () => {
    await seed(env, { "delegations/a1": delegation() });
    const d = db(env, "dg");
    await assertFails(updateDoc(doc(d, "approvals", "D1"), advance({ status: "Approved", currentApproverUid: null, step: 0 })));
    await assertFails(updateDoc(doc(d, "approvals", "D1"), advance({ approverUids: ["au", "a1", "a2", "x"] })));
    await assertFails(updateDoc(doc(d, "approvals", "D1"), advance({ title: "바꿈" })));
  });

  it("내가 기안한 문서는 위임받아도 결재할 수 없다", async () => {
    await seed(env, { "delegations/a1": delegation({ delegateUid: "au" }) });
    await assertFails(updateDoc(doc(db(env, "au"), "approvals", "D1"), advance()));
  });

  it("다음 차례로 넘어가면 위임받은 권한도 끝난다", async () => {
    await seed(env, { "delegations/a1": delegation(), "approvals/D1": approval(advance()) });
    await assertFails(getDoc(doc(db(env, "dg"), "approvals", "D1")));
  });

  it("결재 의견을 남기고 첨부를 열람할 수 있다", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), "approvals/D1/au/f.pdf"), new Uint8Array([1]));
    });
    const s = (uid: string) => env.authenticatedContext(uid).storage();
    await assertFails(getBytes(ref(s("dg"), "approvals/D1/au/f.pdf")));
    await seed(env, { "delegations/a1": delegation() });
    await assertSucceeds(getBytes(ref(s("dg"), "approvals/D1/au/f.pdf")));
    await assertSucceeds(
      setDoc(doc(db(env, "dg"), "approvals", "D1", "comments", "c1"), { uid: "dg", body: "대리 확인" }),
    );
  });
});
