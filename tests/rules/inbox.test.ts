import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, db, members, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...members("a", "b"),
    "users/a/inbox/n1": { cat: "결재", title: "결재 최종 승인", desc: "", href: "/approval/1", icon: "CircleCheck", at: null, readAt: null },
  });
});

describe("알림 받은편지함 (users/{uid}/inbox)", () => {
  it("본인만 읽는다", async () => {
    await assertSucceeds(getDocs(collection(db(env, "a"), "users", "a", "inbox")));
    await assertFails(getDocs(collection(db(env, "b"), "users", "a", "inbox")));
  });

  it("클라이언트는 본인 것도 새로 만들 수 없다 — 남의 받은편지함에 가짜 알림 방지", async () => {
    await assertFails(setDoc(doc(db(env, "b"), "users", "a", "inbox", "fake"), { title: "결재 승인" }));
    await assertFails(setDoc(doc(db(env, "a"), "users", "a", "inbox", "fake"), { title: "x" }));
  });

  it("본인은 읽음 표시만 바꾸고 지울 수 있다", async () => {
    const a = db(env, "a");
    await assertSucceeds(updateDoc(doc(a, "users", "a", "inbox", "n1"), { readAt: new Date() }));
    await assertFails(updateDoc(doc(a, "users", "a", "inbox", "n1"), { title: "바꿈" }));
    await assertFails(deleteDoc(doc(db(env, "b"), "users", "a", "inbox", "n1")));
    await assertSucceeds(deleteDoc(doc(a, "users", "a", "inbox", "n1")));
  });
});
