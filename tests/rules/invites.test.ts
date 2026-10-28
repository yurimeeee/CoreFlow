import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, db, member, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

const future = () => Timestamp.fromDate(new Date(Date.now() + 86_400_000));
const invite = (o: Record<string, unknown> = {}) => ({
  token: "x",
  email: "new@x.com",
  employeeId: "E1",
  teamId: "t1",
  managerId: "m1",
  position: "사원",
  role: "MEMBER",
  status: "INVITED",
  requireApproval: false,
  expiresAt: future(),
  completedUid: null,
  completedAt: null,
  ...o,
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    ...member("admin", "ADMIN"),
    "invites/tokMember": invite({ token: "tokMember" }),
    "invites/tokAdmin": invite({ token: "tokAdmin", email: "boss@x.com", role: "ADMIN" }),
    "invites/tokExpired": invite({
      token: "tokExpired",
      email: "late@x.com",
      expiresAt: Timestamp.fromDate(new Date(Date.now() - 86_400_000)),
    }),
    "invites/tokApprove": invite({ token: "tokApprove", email: "wait@x.com", requireApproval: true }),
  });
});

/** useSignUp 과 같은 배치(users 생성 + invites 완료 처리) */
function signup(uid: string, email: string, inviteId: string, user: Record<string, unknown> = {}) {
  const d = db(env, uid, email);
  const b = writeBatch(d);
  b.set(doc(d, "users", uid), {
    uid,
    email,
    teamId: "t1",
    managerId: "m1",
    role: "MEMBER",
    status: "ACTIVE",
    employeeId: "E1",
    position: "사원",
    inviteId,
    ...user,
  });
  b.update(doc(d, "invites", inviteId), {
    status: "COMPLETED",
    completedUid: uid,
    completedAt: serverTimestamp(),
  });
  return b.commit();
}

describe("invites 조회", () => {
  it("비로그인도 토큰(문서 id)으로 get 할 수 있다", async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), "invites", "tokMember")));
  });

  it("비로그인 limit(1) 목록 조회는 거부된다", async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(query(collection(anon, "invites"), limit(1))));
  });

  it("일반 구성원의 목록 조회는 거부되고 관리자는 허용된다", async () => {
    await seed(env, member("m"));
    await assertFails(getDocs(collection(db(env, "m"), "invites")));
    await assertSucceeds(getDocs(collection(db(env, "admin"), "invites")));
  });
});

describe("invites 완료 처리", () => {
  it("완료 처리하면서 role 을 함께 바꿀 수 없다", async () => {
    await assertFails(
      updateDoc(doc(db(env, "u1", "new@x.com"), "invites", "tokMember"), {
        status: "COMPLETED",
        completedUid: "u1",
        role: "SUPER_ADMIN",
      }),
    );
  });
});

describe("가입(users create)", () => {
  it("본인 초대장으로 정상 가입할 수 있다", async () => {
    await assertSucceeds(signup("u1", "new@x.com", "tokMember"));
  });

  it("남의 ADMIN 초대장으로는 가입할 수 없다", async () => {
    await assertFails(signup("evil", "evil@x.com", "tokAdmin", { role: "ADMIN" }));
  });

  it("만료된 초대장으로는 가입할 수 없다", async () => {
    await assertFails(signup("late", "late@x.com", "tokExpired"));
  });

  it("이미 사용된 초대장은 재사용할 수 없다", async () => {
    await assertSucceeds(signup("u1", "new@x.com", "tokMember"));
    await assertFails(signup("u9", "new@x.com", "tokMember"));
  });

  it("승인 필요 초대는 PENDING 으로만 가입된다", async () => {
    await assertFails(signup("w", "wait@x.com", "tokApprove", { status: "ACTIVE" }));
    await assertSucceeds(signup("w", "wait@x.com", "tokApprove", { status: "PENDING" }));
  });

  it("사번·직급을 임의로 지정할 수 없다", async () => {
    await assertFails(signup("u1", "new@x.com", "tokMember", { employeeId: "E999" }));
    await assertFails(signup("u1", "new@x.com", "tokMember", { position: "대표" }));
  });
});
