import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, db, member, members, seed } from "./helpers";
import { localDateStr } from "../../src/lib/utils";

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

describe("attendance/{uid}/days", () => {
  const today = localDateStr();
  const day = (uid: string, date = today, target = uid) =>
    doc(db(env, uid), "attendance", target, "days", date);

  it("오늘 날짜로 출근을 만들고 퇴근을 찍을 수 있다", async () => {
    await assertSucceeds(setDoc(day("me"), { date: today, inTs: serverTimestamp(), outTs: null }));
    await assertSucceeds(updateDoc(day("me"), { outTs: serverTimestamp() }));
    await assertSucceeds(updateDoc(day("me"), { outTs: null }));
  });

  it("출근 시각은 바꿀 수 없고 임의 시각으로 쓸 수 없다", async () => {
    await assertFails(setDoc(day("me"), { date: today, inTs: nineAm, outTs: null }));
    await assertSucceeds(setDoc(day("me"), { date: today, inTs: serverTimestamp(), outTs: null }));
    await assertFails(updateDoc(day("me"), { inTs: serverTimestamp() }));
    await assertFails(updateDoc(day("me"), { outTs: nineAm }));
  });

  it("지난 날짜 기록은 새로 만들 수 없다", async () => {
    await assertFails(
      setDoc(day("me", "2026-01-05"), { date: "2026-01-05", inTs: serverTimestamp(), outTs: null }),
    );
  });

  it("남의 기록은 쓸 수 없고, 관리자는 읽을 수 있다", async () => {
    await assertFails(
      setDoc(day("other", today, "me"), { date: today, inTs: serverTimestamp(), outTs: null }),
    );
    await assertSucceeds(setDoc(day("me"), { date: today, inTs: serverTimestamp(), outTs: null }));
    await assertFails(getDoc(day("other", today, "me")));
    await seed(env, member("boss", "ADMIN"));
    await assertSucceeds(getDoc(day("boss", today, "me")));
  });
});
