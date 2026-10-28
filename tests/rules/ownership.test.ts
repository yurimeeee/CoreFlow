import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, db, member, members, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...member("admin", "ADMIN"),
    ...members("me", "v", "maker", "assignee", "other"),
    "chats/c1": { memberIds: ["me", "v"] },
    "chats/c1/messages/m1": { senderId: "me", text: "hi" },
    "notices/n1": { status: "published", authorUid: "x" },
    "notices/n1/comments/k": { uid: "me", body: "a" },
    "tasks/t1/comments/k": { uid: "me", body: "a" },
    "approvals/A": { authorUid: "me", status: "Waiting" },
    "approvals/A/comments/k": { uid: "me", body: "a" },
    "tasks/t1": { title: "T", colKey: "todo", order: 0, done: 0, createdBy: "maker", assigneeId: "assignee" },
    "tasks/legacy": { title: "L", colKey: "todo", order: 1, assigneeId: "assignee" },
    "bookings/b1": { title: "B", ownerUid: "me" },
    "bookings/legacy": { title: "L", who: "me" },
  });
});

describe("댓글·메시지 작성자 사칭", () => {
  it("메시지를 고치면서 senderId 를 바꿀 수 없다", async () => {
    const d = db(env, "me");
    await assertFails(updateDoc(doc(d, "chats/c1/messages", "m1"), { senderId: "v", text: "x" }));
    await assertSucceeds(updateDoc(doc(d, "chats/c1/messages", "m1"), { text: "x" }));
  });

  it.each(["notices/n1/comments", "tasks/t1/comments", "approvals/A/comments"])(
    "%s: 댓글을 고치면서 uid 를 바꿀 수 없다",
    async (path) => {
      const d = db(env, "me");
      await assertFails(updateDoc(doc(d, path, "k"), { uid: "v" }));
      await assertSucceeds(updateDoc(doc(d, path, "k"), { body: "b", edited: true }));
    },
  );
});

describe("tasks", () => {
  it("만든 사람을 남으로 지정해 만들 수 없다", async () => {
    await assertFails(setDoc(doc(db(env, "other"), "tasks", "n"), { title: "x", createdBy: "maker" }));
    await assertSucceeds(setDoc(doc(db(env, "other"), "tasks", "n"), { title: "x", createdBy: "other" }));
  });

  it("관련 없는 구성원은 내용·진행 상태를 바꾸거나 삭제할 수 없다", async () => {
    const d = db(env, "other");
    await assertFails(updateDoc(doc(d, "tasks", "t1"), { title: "hack" }));
    await assertFails(updateDoc(doc(d, "tasks", "t1"), { colKey: "done" }));
    await assertFails(deleteDoc(doc(d, "tasks", "t1")));
  });

  it("관련 없는 구성원도 칸반 정렬(order)은 바꿀 수 있다", async () => {
    await assertSucceeds(updateDoc(doc(db(env, "other"), "tasks", "t1"), { order: 5 }));
  });

  it("담당자는 수정할 수 있지만 삭제는 만든 사람·관리자만 가능하다", async () => {
    await assertSucceeds(updateDoc(doc(db(env, "assignee"), "tasks", "t1"), { colKey: "doing" }));
    await assertFails(deleteDoc(doc(db(env, "assignee"), "tasks", "t1")));
    await assertSucceeds(deleteDoc(doc(db(env, "maker"), "tasks", "t1")));
  });

  it("만든 사람도 createdBy 를 넘길 수 없다", async () => {
    await assertFails(updateDoc(doc(db(env, "maker"), "tasks", "t1"), { createdBy: "other" }));
  });

  it("createdBy 없는 기존 카드는 담당자가 수정하고 관리자가 삭제한다", async () => {
    await assertSucceeds(updateDoc(doc(db(env, "assignee"), "tasks", "legacy"), { title: "x" }));
    await assertFails(deleteDoc(doc(db(env, "assignee"), "tasks", "legacy")));
    await assertSucceeds(deleteDoc(doc(db(env, "admin"), "tasks", "legacy")));
  });
});

describe("bookings", () => {
  it("예약자를 남으로 지정해 예약할 수 없다", async () => {
    await assertFails(setDoc(doc(db(env, "other"), "bookings", "n"), { title: "x", ownerUid: "me" }));
    await assertSucceeds(setDoc(doc(db(env, "other"), "bookings", "n"), { title: "x", ownerUid: "other" }));
  });

  it("남의 예약은 취소할 수 없고 본인·관리자는 취소할 수 있다", async () => {
    await assertFails(deleteDoc(doc(db(env, "other"), "bookings", "b1")));
    await assertSucceeds(deleteDoc(doc(db(env, "me"), "bookings", "b1")));
    await assertSucceeds(deleteDoc(doc(db(env, "admin"), "bookings", "legacy")));
  });

  it("ownerUid 없는 기존 예약은 관리자만 취소할 수 있다", async () => {
    await assertFails(deleteDoc(doc(db(env, "me"), "bookings", "legacy")));
  });
});
