import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, members, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

const file = new Uint8Array([1, 2, 3]);
const storage = (uid: string) => env.authenticatedContext(uid).storage();

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env, members("au", "a1", "other"));
});

describe("결재 첨부 — 문서 생성 전", () => {
  it("본인 폴더에는 올리고 읽을 수 있다", async () => {
    const r = ref(storage("au"), "approvals/NEW-1/au/f.pdf");
    await assertSucceeds(uploadBytes(r, file));
    await assertSucceeds(getBytes(r));
  });

  it("남의 폴더에 쓰거나 남의 작성 중 첨부를 읽을 수 없다", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), "approvals/NEW-1/au/f.pdf"), file);
    });
    await assertFails(uploadBytes(ref(storage("other"), "approvals/NEW-1/au/x.pdf"), file));
    await assertFails(getBytes(ref(storage("other"), "approvals/NEW-1/au/f.pdf")));
  });

  it("예전 경로(approvals/{no}/{파일})로는 새로 올릴 수 없다", async () => {
    await assertFails(uploadBytes(ref(storage("au"), "approvals/NEW-1/f.pdf"), file));
  });
});

describe("결재 첨부 — 문서 생성 후", () => {
  beforeEach(async () => {
    await seed(env, {
      "approvals/D1": { authorUid: "au", currentApproverUid: "a1", approverUids: ["au", "a1"] },
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), "approvals/D1/au/f.pdf"), file);
      await uploadBytes(ref(ctx.storage(), "approvals/D1/legacy.pdf"), file);
    });
  });

  it("결재선은 읽을 수 있고 무관한 구성원은 읽을 수 없다", async () => {
    await assertSucceeds(getBytes(ref(storage("a1"), "approvals/D1/au/f.pdf")));
    await assertFails(getBytes(ref(storage("other"), "approvals/D1/au/f.pdf")));
  });

  it("기안자 외에는 첨부를 추가할 수 없다", async () => {
    await assertSucceeds(uploadBytes(ref(storage("au"), "approvals/D1/au/g.pdf"), file));
    await assertFails(uploadBytes(ref(storage("a1"), "approvals/D1/a1/g.pdf"), file));
  });

  it("예전 경로 첨부도 결재선만 읽을 수 있다", async () => {
    await assertSucceeds(getBytes(ref(storage("a1"), "approvals/D1/legacy.pdf")));
    await assertFails(getBytes(ref(storage("other"), "approvals/D1/legacy.pdf")));
  });
});
