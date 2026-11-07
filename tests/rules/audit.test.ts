import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, auditedBatch, createEnv, db, member, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...member("adm", "ADMIN"),
    ...member("adm2", "ADMIN"),
    ...member("m"),
    "users/target": {
      uid: "target",
      role: "MEMBER",
      status: "ACTIVE",
      employeeId: "CF-9",
      teamId: null,
      managerId: null,
      email: "t@x.com",
    },
    "teams/t1": { name: "개발", parentId: null, order: 0 },
    "auditLogs/old": { actorUid: "adm", action: "test", targets: ["teams/t1"], summary: "", at: Timestamp.fromMillis(0) },
  });
});

const team = { name: "디자인", parentId: null, order: 1 };

describe("관리자 전용 쓰기는 감사 로그와 함께만", () => {
  it("로그 없이 쓰면 거부, 같은 배치에 로그가 있으면 허용", async () => {
    await assertFails(setDoc(doc(db(env, "adm"), "teams", "t2"), team));
    await assertSucceeds(auditedBatch(env, "adm", ["teams/t2"], (b, d) => b.set(doc(d, "teams", "t2"), team)));
  });

  it("로그의 대상(targets)에 없는 문서는 거부", async () => {
    await assertFails(auditedBatch(env, "adm", ["teams/other"], (b, d) => b.set(doc(d, "teams", "t2"), team)));
  });

  it("예전 로그를 다시 가리켜 재사용할 수 없다", async () => {
    await assertFails(
      auditedBatch(env, "adm", ["teams/t1"], (b, d) => {
        b.set(doc(d, "auditCursor", "adm"), { logId: "old" });
        b.update(doc(d, "teams", "t1"), { name: "x" });
      }),
    );
  });

  it("다른 관리자 명의의 로그는 만들 수 없다", async () => {
    await assertFails(
      auditedBatch(env, "adm", ["teams/t2"], (b, d) => b.set(doc(d, "teams", "t2"), team), { actorUid: "adm2" }),
    );
  });

  it("한 로그로 여러 문서를 함께 바꿀 수 있다", async () => {
    await assertSucceeds(
      auditedBatch(env, "adm", ["teams/t2", "workspace/main"], (b, d) => {
        b.set(doc(d, "teams", "t2"), team);
        b.set(doc(d, "workspace", "main"), { name: "CoreFlow" });
      }),
    );
  });

  it("구성원 수정·삭제, 가계정 생성, 초대장 발급, 워크스페이스 설정 모두 적용", async () => {
    const a = db(env, "adm");
    await assertFails(updateDoc(doc(a, "users", "target"), { role: "ADMIN" }));
    await assertFails(deleteDoc(doc(a, "users", "target")));
    await assertFails(setDoc(doc(a, "users", "placeholder-1"), { uid: "placeholder-1", status: "PLACEHOLDER" }));
    await assertFails(setDoc(doc(a, "invites", "tok"), { email: "n@x.com", role: "MEMBER" }));
    await assertFails(setDoc(doc(a, "workspace", "main"), { name: "x" }));

    await assertSucceeds(
      auditedBatch(env, "adm", ["users/target"], (b, d) => b.update(doc(d, "users", "target"), { role: "ADMIN" })),
    );
    await assertSucceeds(
      auditedBatch(env, "adm", ["users/placeholder-1"], (b, d) =>
        b.set(doc(d, "users", "placeholder-1"), { uid: "placeholder-1", status: "PLACEHOLDER" }),
      ),
    );
    await assertSucceeds(
      auditedBatch(env, "adm", ["invites/tok"], (b, d) =>
        b.set(doc(d, "invites", "tok"), { email: "n@x.com", role: "MEMBER" }),
      ),
    );
    await assertSucceeds(
      auditedBatch(env, "adm", ["users/target"], (b, d) => b.delete(doc(d, "users", "target"))),
    );
  });

  it("관리자가 본인 프로필을 고치는 건 본인 수정 경로라 로그가 필요 없다", async () => {
    await seed(env, {
      "users/adm": { uid: "adm", role: "ADMIN", status: "ACTIVE", employeeId: "", teamId: null, managerId: null, email: "a@x.com" },
    });
    await assertSucceeds(updateDoc(doc(db(env, "adm"), "users", "adm"), { phone: "010" }));
  });
});

describe("감사 로그 자체", () => {
  it("일반 구성원은 로그를 만들거나 읽을 수 없다", async () => {
    await assertFails(auditedBatch(env, "m", ["users/m"], () => {}));
    await assertFails(getDocs(collection(db(env, "m"), "auditLogs")));
  });

  it("관리자는 읽을 수 있지만 수정·삭제는 아무도 못 한다", async () => {
    const a = db(env, "adm");
    await assertSucceeds(getDoc(doc(a, "auditLogs", "old")));
    await assertFails(updateDoc(doc(a, "auditLogs", "old"), { summary: "x" }));
    await assertFails(deleteDoc(doc(a, "auditLogs", "old")));
  });

  it("시각을 직접 적거나 허용되지 않은 필드를 넣을 수 없다", async () => {
    const write = (b: WriteBatch, d: Firestore) => b.set(doc(d, "teams", "t2"), team);
    await assertFails(auditedBatch(env, "adm", ["teams/t2"], write, { at: Timestamp.fromMillis(0) }));
    await assertFails(auditedBatch(env, "adm", ["teams/t2"], write, { extra: 1 }));
  });

  it("남의 auditCursor 는 쓸 수 없다", async () => {
    await assertFails(setDoc(doc(db(env, "adm"), "auditCursor", "adm2"), { logId: "old" }));
  });
});
