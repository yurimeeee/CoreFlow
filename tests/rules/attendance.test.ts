import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, db, members, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, members("me", "other"));
});

const ref = (uid: string, target = uid) => doc(db(env, uid), "attendance", target);
const nineAm = Timestamp.fromDate(new Date("2026-10-29T09:00:00+09:00"));

describe("attendance", () => {
  it("서버 시각으로 출근·퇴근을 기록할 수 있다", async () => {
    await assertSucceeds(
      setDoc(ref("me"), { working: true, inTs: serverTimestamp(), outTs: null, date: "2026-10-29" }, { merge: true }),
    );
    await assertSucceeds(
      setDoc(ref("me"), { working: false, outTs: serverTimestamp(), date: "2026-10-29" }, { merge: true }),
    );
  });

  it("출근 시각을 임의 값으로 쓸 수 없다", async () => {
    await assertFails(setDoc(ref("me"), { working: true, inTs: nineAm, date: "2026-10-29" }, { merge: true }));
  });

  it("예전 문자열 필드(inAt)나 집계 필드는 쓸 수 없다", async () => {
    await assertFails(setDoc(ref("me"), { working: true, inAt: "09:00" }, { merge: true }));
    await assertFails(setDoc(ref("me"), { weekWorked: 40 }, { merge: true }));
  });

  it("남의 근태 문서는 쓸 수 없다", async () => {
    await assertFails(
      setDoc(ref("other", "me"), { working: true, inTs: serverTimestamp() }, { merge: true }),
    );
  });
});
