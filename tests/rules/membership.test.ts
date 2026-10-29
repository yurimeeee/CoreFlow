import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, db, member, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...member("m"),
    "users/pending": { uid: "pending", role: "MEMBER", status: "PENDING" },
    "users/suspended": { uid: "suspended", role: "ADMIN", status: "SUSPENDED" },
    "notices/n1": { status: "published", authorUid: "m", title: "T" },
    "tasks/t1": { title: "T", createdBy: "m" },
  });
});

describe("구성원(ACTIVE)만 공용 데이터 접근", () => {
  it("users 문서 없이 Auth 계정만 만든 외부인은 디렉터리·공지·Task 를 못 읽는다", async () => {
    const outsider = db(env, "outsider");
    await assertFails(getDocs(collection(outsider, "users")));
    await assertFails(getDoc(doc(outsider, "notices", "n1")));
    await assertFails(getDocs(collection(outsider, "tasks")));
  });

  it("승인 대기 계정은 공용 데이터를 못 읽지만 본인 users 문서는 읽는다", async () => {
    const p = db(env, "pending");
    await assertFails(getDocs(collection(p, "users")));
    await assertFails(getDoc(doc(p, "notices", "n1")));
    await assertSucceeds(getDoc(doc(p, "users", "pending")));
  });

  it("정지된 관리자 계정은 관리자 권한도 잃는다", async () => {
    await assertFails(setDoc(doc(db(env, "suspended"), "teams", "x"), { name: "x" }));
  });

  it("ACTIVE 구성원은 읽을 수 있다", async () => {
    const d = db(env, "m");
    await assertSucceeds(getDocs(collection(d, "users")));
    await assertSucceeds(getDoc(doc(d, "notices", "n1")));
  });
});

describe("Storage 프로필 이미지", () => {
  const png = new Uint8Array([137, 80, 78, 71]);

  it("가입 직후(users 문서 전) 본인 파일은 올리고 읽을 수 있다", async () => {
    const s = env.authenticatedContext("newbie").storage();
    const r = ref(s, "users/newbie/profile.png");
    await assertSucceeds(uploadBytes(r, png, { contentType: "image/png" }));
    await assertSucceeds(getBytes(r));
  });

  it("구성원이 아니면 남의 프로필은 읽을 수 없다", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), "users/m/profile.png"), png, { contentType: "image/png" });
    });
    await assertFails(getBytes(ref(env.authenticatedContext("outsider").storage(), "users/m/profile.png")));
    await assertSucceeds(getBytes(ref(env.authenticatedContext("m").storage(), "users/m/profile.png")));
  });
});

describe("integrationSecrets (웹훅 URL)", () => {
  beforeEach(async () => {
    await seed(env, {
      ...member("admin", "ADMIN"),
      "integrationSecrets/main": { slack: { webhookUrl: "https://hooks.slack.com/x" } },
    });
  });

  it("일반 구성원은 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(db(env, "m"), "integrationSecrets", "main")));
  });

  it("관리자는 읽고 쓸 수 있다", async () => {
    await assertSucceeds(getDoc(doc(db(env, "admin"), "integrationSecrets", "main")));
    await assertSucceeds(
      setDoc(doc(db(env, "admin"), "integrationSecrets", "main"), { jandi: { webhookUrl: "https://wh.jandi.com/x" } }),
    );
  });
});
