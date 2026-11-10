import { describe, expect, it } from "vitest";
import { isPendingApprover, isProxyTurn } from "./hooks";

const line = (
  overrides: Partial<{
    kind: string;
    name: string;
    role: string;
    state: string;
    at: string;
    done: boolean;
    uid?: string;
  }> = {},
) => ({
  kind: "결재",
  name: "김철수",
  role: "팀장",
  state: "대기",
  at: "",
  done: false,
  ...overrides,
});

describe("isPendingApprover", () => {
  it("Approved 문서는 항상 false를 반환한다", () => {
    expect(
      isPendingApprover(
        { status: "Approved", line: [line({ uid: "u1" })], currentApproverUid: "u1" },
        { uid: "u1", name: "김철수" },
      ),
    ).toBe(false);
  });

  it("Rejected 문서는 항상 false를 반환한다", () => {
    expect(
      isPendingApprover(
        { status: "Rejected", line: [line({ uid: "u1" })], currentApproverUid: "u1" },
        { uid: "u1", name: "김철수" },
      ),
    ).toBe(false);
  });

  it("모든 결재 단계가 완료되면(대기 중인 단계 없음) false를 반환한다", () => {
    expect(
      isPendingApprover(
        { status: "Waiting", line: [line({ done: true, uid: "u1" })], currentApproverUid: null },
        { uid: "u1", name: "김철수" },
      ),
    ).toBe(false);
  });

  it("기안(kind '기안') 단계는 결재 대기로 치지 않는다", () => {
    expect(
      isPendingApprover(
        {
          status: "Waiting",
          line: [line({ kind: "기안", done: false, uid: "u1" })],
          currentApproverUid: null,
        },
        { uid: "u1", name: "김철수" },
      ),
    ).toBe(false);
  });

  it("currentApproverUid가 있으면 그 값과 내 uid를 비교한다", () => {
    const doc = {
      status: "Waiting",
      line: [line({ uid: "someone-else", done: false })],
      currentApproverUid: "u1",
    };
    expect(isPendingApprover(doc, { uid: "u1", name: "김철수" })).toBe(true);
    expect(isPendingApprover(doc, { uid: "u2", name: "다른사람" })).toBe(false);
  });

  it("currentApproverUid가 없는 레거시 문서는 대기 단계의 uid로 판정한다", () => {
    const doc = {
      status: "Waiting",
      line: [line({ uid: "u1", done: false })],
      currentApproverUid: null,
    };
    expect(isPendingApprover(doc, { uid: "u1", name: "김철수" })).toBe(true);
    expect(isPendingApprover(doc, { uid: "u2", name: "다른사람" })).toBe(false);
  });

  it("uid도 없는 더 오래된 레거시 문서는 이름으로 폴백해 판정한다", () => {
    const doc = {
      status: "Waiting",
      line: [line({ uid: undefined, name: "김철수", done: false })],
      currentApproverUid: null,
    };
    expect(isPendingApprover(doc, { uid: null, name: "김철수" })).toBe(true);
    expect(isPendingApprover(doc, { uid: null, name: "다른사람" })).toBe(false);
  });

  it("이미 완료된 앞 단계를 건너뛰고 첫 미완료 단계를 기준으로 판정한다", () => {
    const doc = {
      status: "Waiting",
      line: [
        line({ uid: "u1", done: true }),
        line({ uid: "u2", done: false }),
      ],
      currentApproverUid: null,
    };
    expect(isPendingApprover(doc, { uid: "u1", name: "김철수" })).toBe(false);
    expect(isPendingApprover(doc, { uid: "u2", name: "이영희" })).toBe(true);
  });

  it("line이 없는 문서는 false를 반환한다", () => {
    expect(
      isPendingApprover(
        { status: "Waiting", line: undefined, currentApproverUid: null },
        { uid: "u1", name: "김철수" },
      ),
    ).toBe(false);
  });
});

describe("대리 결재 차례 (결재 위임)", () => {
  const doc = {
    status: "Waiting",
    authorUid: "au",
    line: [line({ kind: "기안", uid: "au", done: true }), line({ uid: "a1" })],
    currentApproverUid: "a1",
  };

  it("차례인 사람이 나에게 위임했으면 내 차례로 본다", () => {
    expect(isPendingApprover(doc, { uid: "dg", name: "대리" }, ["a1"])).toBe(true);
    expect(isProxyTurn(doc, "dg", ["a1"])).toBe(true);
    expect(isPendingApprover(doc, { uid: "dg", name: "대리" }, ["other"])).toBe(false);
  });

  it("내가 기안한 문서는 위임받아도 내 차례가 아니다", () => {
    expect(isPendingApprover(doc, { uid: "au", name: "기안" }, ["a1"])).toBe(false);
  });

  it("원래 결재자 본인은 대리가 아니다", () => {
    expect(isProxyTurn(doc, "a1", ["a1"])).toBe(false);
    expect(isPendingApprover(doc, { uid: "a1", name: "김철수" })).toBe(true);
  });
});
