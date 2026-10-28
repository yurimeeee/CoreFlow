import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, createEnv, db, members, seed } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(() => env.cleanup());

const line = [
  { kind: "기안", uid: "au", done: true },
  { kind: "결재", uid: "a1", done: false },
  { kind: "결재", uid: "a2", done: false },
  { kind: "결재", uid: "a3", done: false },
];
const leaveRequest = { kind: "연차", start: "2026-11-02", end: "2026-11-02", days: 1 };
const approval = (o: Record<string, unknown> = {}) => ({
  type: "휴가",
  title: "T",
  authorUid: "au",
  status: "Waiting",
  bucket: "pending",
  line,
  currentApproverUid: "a1",
  approverUids: ["au", "a1", "a2", "a3"],
  approverSeq: ["a1", "a2", "a3"],
  step: 0,
  leaveRequest,
  ...o,
});
const approved = (uid: string, o: Record<string, unknown> = {}) => ({
  uid,
  who: "x",
  hours: 0,
  reason: "",
  order: 1,
  status: "승인",
  ...leaveRequest,
  ...o,
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, members("au", "a1", "a2", "a3"));
});

const create = (id: string, data: Record<string, unknown>) =>
  setDoc(doc(db(env, "au"), "approvals", id), data);
const advance = (uid: string, data: Record<string, unknown>) =>
  updateDoc(doc(db(env, uid), "approvals", "D1"), data);

describe("상신(create)", () => {
  it("올바른 결재 순서로 상신할 수 있다", async () => {
    await assertSucceeds(create("D1", approval()));
  });

  it("결재 순서가 틀리거나 본인이 포함되면 거부된다", async () => {
    await assertFails(create("X", approval({ approverSeq: ["a1", "au"] })));
    await assertFails(create("X", approval({ currentApproverUid: "a3" })));
    await assertFails(create("X", approval({ step: 2, currentApproverUid: "a3" })));
    const noSeq: Record<string, unknown> = approval();
    delete noSeq.approverSeq;
    await assertFails(create("X", noSeq));
  });

  it("처음부터 Approved 로 만들 수 없다", async () => {
    await assertFails(create("X", approval({ status: "Approved" })));
  });
});

describe("임시저장", () => {
  it("결재자 미지정 상태로 임시저장하고 나중에 상신할 수 있다", async () => {
    await assertSucceeds(
      create("DR", approval({ bucket: "drafted", approverSeq: [""], currentApproverUid: null })),
    );
    await assertSucceeds(create("DR", approval()));
  });

  it("결재자는 임시저장 문서를 결재할 수 없다", async () => {
    await assertSucceeds(create("D1", approval({ bucket: "drafted" })));
    await assertFails(advance("a1", { status: "In Progress", currentApproverUid: "a2", step: 1 }));
  });

  it("상신 후에는 기안자가 결재자·유형을 바꿀 수 없다", async () => {
    await assertSucceeds(create("D1", approval()));
    await assertFails(advance("au", { currentApproverUid: "a3" }));
    await assertFails(advance("au", { type: "지출" }));
  });
});

describe("결재 진행", () => {
  beforeEach(async () => {
    await assertSucceeds(create("D1", approval()));
  });

  it("자기 차례가 아니면 결재할 수 없다", async () => {
    await assertFails(advance("a2", { status: "In Progress", currentApproverUid: "a3", step: 1 }));
  });

  it("뒤 결재자를 건너뛰어 최종 승인하거나 다음 단계를 건너뛸 수 없다", async () => {
    await assertFails(advance("a1", { status: "Approved", currentApproverUid: null }));
    await assertFails(advance("a1", { status: "In Progress", currentApproverUid: "a3", step: 2 }));
  });

  it("결재하면서 다른 필드를 함께 고칠 수 없다", async () => {
    await assertFails(
      advance("a1", { status: "In Progress", currentApproverUid: "a2", step: 1, title: "x" }),
    );
  });

  it("순서대로 최종 승인하면 연차가 결재 내용 그대로만 반영된다", async () => {
    await assertSucceeds(advance("a1", { status: "In Progress", line, currentApproverUid: "a2", step: 1 }));
    await assertSucceeds(advance("a2", { status: "In Progress", line, currentApproverUid: "a3", step: 2 }));
    await assertFails(setDoc(doc(db(env, "a3"), "leaves", "D1"), approved("au")));
    await assertSucceeds(advance("a3", { status: "Approved", line, currentApproverUid: null }));
    await assertFails(setDoc(doc(db(env, "a3"), "leaves", "D1"), approved("au", { days: 10 })));
    await assertSucceeds(setDoc(doc(db(env, "a3"), "leaves", "D1"), approved("au")));
    await assertFails(advance("a3", { status: "Rejected", currentApproverUid: null }));
  });

  it("현재 결재자는 반려할 수 있다", async () => {
    await assertSucceeds(advance("a1", { status: "Rejected", line, currentApproverUid: null }));
  });
});

describe("approverSeq 도입 전 문서", () => {
  beforeEach(async () => {
    await seed(env, {
      "approvals/LEG": {
        authorUid: "au",
        status: "Waiting",
        bucket: "pending",
        currentApproverUid: "a1",
        line,
      },
    });
  });

  it("결재 진행 필드만 바꿀 수 있다", async () => {
    const ref = (uid: string) => doc(db(env, uid), "approvals", "LEG");
    await assertSucceeds(updateDoc(ref("a1"), { status: "In Progress", line, currentApproverUid: "a2" }));
    await assertFails(updateDoc(ref("a2"), { status: "In Progress", authorUid: "a2" }));
  });
});
