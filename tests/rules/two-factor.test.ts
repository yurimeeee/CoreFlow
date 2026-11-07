import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { getBytes, ref } from "firebase/storage";
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
    ...member("plain"),
    // 본인 update 규칙이 비교하는 필드까지 채워 둡니다
    "users/tfa": {
      uid: "tfa",
      role: "MEMBER",
      status: "ACTIVE",
      employeeId: "CF-1",
      teamId: null,
      managerId: null,
      email: "tfa@x.com",
      twoFactorId: "enr-1",
    },
    "userSecrets/tfa": { secret: "JBSWY3DPEHPK3PXP", backupCodeHashes: [] },
    "notices/n1": { status: "published", authorUid: "plain", title: "T" },
  });
});

/** 2FA 클레임(서버가 발급한 커스텀 토큰으로 로그인한 세션)을 흉내냅니다. */
const withClaim = (uid: string, twoFactorId?: string) =>
  env.authenticatedContext(uid, twoFactorId ? { twoFactorId } : {}).firestore();

describe("2FA 미통과 세션은 구성원 권한이 없다", () => {
  it("비밀번호만으로 로그인한 세션은 공용 데이터를 못 읽는다", async () => {
    await assertFails(getDoc(doc(withClaim("tfa"), "notices", "n1")));
    await assertFails(getDocs(collection(withClaim("tfa"), "users")));
  });

  it("다른 등록 id 의 클레임(이전 등록·2FA가 꺼져 있던 동안 받은 토큰)으로는 못 읽는다", async () => {
    await assertFails(getDoc(doc(withClaim("tfa", "enr-old"), "notices", "n1")));
  });

  it("현재 등록 id 의 클레임이 있으면 읽을 수 있다", async () => {
    await assertSucceeds(getDoc(doc(withClaim("tfa", "enr-1"), "notices", "n1")));
  });

  it("2FA를 켜지 않은 계정은 클레임 없이도 그대로 읽는다", async () => {
    await assertSucceeds(getDoc(doc(db(env, "plain"), "notices", "n1")));
  });

  it("미통과 세션도 본인 users 문서는 읽는다 (로그인 화면이 상태를 판단)", async () => {
    await assertSucceeds(getDoc(doc(withClaim("tfa"), "users", "tfa")));
  });

  it("Storage 도 같은 기준으로 막는다", async () => {
    const s = env.authenticatedContext("tfa").storage();
    await assertFails(getBytes(ref(s, "users/plain/profile.png")));
  });
});

describe("2FA 켜짐 여부·비밀키는 클라이언트가 못 건드린다", () => {
  it("본인도 userSecrets 를 읽거나 쓸 수 없다", async () => {
    const d = withClaim("tfa", "enr-1");
    await assertFails(getDoc(doc(d, "userSecrets", "tfa")));
    await assertFails(setDoc(doc(d, "userSecrets", "tfa"), { secret: "X", backupCodeHashes: [] }));
    await assertFails(setDoc(doc(db(env, "plain"), "userSecrets", "plain"), { secret: "X" }));
  });

  it("미통과 세션은 twoFactorId 를 지워 2FA를 끌 수 없다", async () => {
    await assertFails(updateDoc(doc(withClaim("tfa"), "users", "tfa"), { twoFactorId: null }));
  });

  it("통과한 세션도 twoFactorId 는 직접 바꿀 수 없다", async () => {
    await assertFails(updateDoc(doc(withClaim("tfa", "enr-1"), "users", "tfa"), { twoFactorId: null }));
    await assertFails(updateDoc(doc(db(env, "plain"), "users", "plain"), { twoFactorId: "mine" }));
  });

  it("미통과 세션은 본인 프로필도 수정할 수 없고, 통과하면 수정할 수 있다", async () => {
    await assertFails(updateDoc(doc(withClaim("tfa"), "users", "tfa"), { phone: "010" }));
    await assertSucceeds(updateDoc(doc(withClaim("tfa", "enr-1"), "users", "tfa"), { phone: "010" }));
  });

  it("관리자는 분실 계정의 2FA를 초기화할 수 있다", async () => {
    await seed(env, member("adm", "ADMIN"));
    await assertSucceeds(
      auditedBatch(env, "adm", ["users/tfa"], (b, d) => b.update(doc(d, "users", "tfa"), { twoFactorId: null })),
    );
  });
});
