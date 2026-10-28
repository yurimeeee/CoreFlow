import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { arrayUnion, deleteDoc, doc, increment, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, db, member, members, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

const notice = {
  cat: "HR",
  title: "T",
  body: "B",
  pinned: false,
  status: "published",
  authorUid: "author",
  views: 0,
  comments: 0,
};

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...member("admin", "ADMIN"),
    ...members("u1", "author", "other"),
    "leaves/p1": { uid: "u1", status: "대기", days: 3 },
    "leaves/a1": { uid: "u1", status: "승인", days: 3 },
    "notices/n1": notice,
  });
});

describe("leaves", () => {
  it("본인이 '대기'를 '승인'으로 바꿀 수 없다", async () => {
    await assertFails(updateDoc(doc(db(env, "u1"), "leaves", "p1"), { status: "승인" }));
  });

  it("승인된 연차의 일수를 0으로 바꿀 수 없다", async () => {
    await assertFails(updateDoc(doc(db(env, "u1"), "leaves", "a1"), { days: 0 }));
  });

  it("'대기' 신청 내용은 본인이 고칠 수 있다", async () => {
    await assertSucceeds(updateDoc(doc(db(env, "u1"), "leaves", "p1"), { days: 2 }));
  });

  it("관리자는 승인할 수 있다", async () => {
    await assertSucceeds(updateDoc(doc(db(env, "admin"), "leaves", "p1"), { status: "승인" }));
  });
});

describe("notices", () => {
  it("남이 authorUid 를 자기 것으로 바꿀 수 없다", async () => {
    await assertFails(updateDoc(doc(db(env, "other"), "notices", "n1"), { authorUid: "other" }));
  });

  it("남의 이름(authorUid)으로 공지를 만들 수 없다", async () => {
    await assertFails(setDoc(doc(db(env, "other"), "notices", "n2"), notice));
    await assertSucceeds(setDoc(doc(db(env, "other"), "notices", "n3"), { ...notice, authorUid: "other" }));
  });

  it("authorUid 없는 시드 공지는 관리자만 만들 수 있다", async () => {
    const seedNotice: Record<string, unknown> = { ...notice };
    delete seedNotice.authorUid;
    await assertFails(setDoc(doc(db(env, "other"), "notices", "s1"), seedNotice));
    await assertSucceeds(setDoc(doc(db(env, "admin"), "notices", "s2"), seedNotice));
  });

  it("열람(조회수 +1, 본인 읽음)·댓글 수 ±1 은 누구나 반영할 수 있다", async () => {
    const d = db(env, "other");
    await assertSucceeds(
      updateDoc(doc(d, "notices", "n1"), { views: increment(1), readByUids: arrayUnion("other") }),
    );
    await assertSucceeds(updateDoc(doc(d, "notices", "n1"), { comments: increment(1) }));
    await assertSucceeds(updateDoc(doc(d, "notices", "n1"), { comments: increment(-1) }));
  });

  it("조회수 임의 조작·남의 읽음 처리·내용 수정은 거부된다", async () => {
    const d = db(env, "other");
    await assertFails(updateDoc(doc(d, "notices", "n1"), { views: 1000 }));
    await assertFails(updateDoc(doc(d, "notices", "n1"), { readByUids: arrayUnion("victim") }));
    await assertFails(updateDoc(doc(d, "notices", "n1"), { title: "hack" }));
  });

  it("작성자는 수정·삭제할 수 있지만 authorUid 를 넘길 수는 없다", async () => {
    const d = db(env, "author");
    await assertSucceeds(updateDoc(doc(d, "notices", "n1"), { title: "new", readByUids: [] }));
    await assertFails(updateDoc(doc(d, "notices", "n1"), { authorUid: "other" }));
    await assertSucceeds(deleteDoc(doc(d, "notices", "n1")));
  });
});
