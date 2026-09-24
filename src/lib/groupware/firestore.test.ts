import { describe, expect, it } from "vitest";
import {
  ANNUAL_LEAVE_TOTAL,
  calculateLeaveBalance,
  chatMessagesPath,
  dmChatId,
  noticeCommentsPath,
} from "./firestore";

describe("dmChatId", () => {
  it("정렬된 두 uid를 '_'로 합친 id를 반환한다", () => {
    expect(dmChatId("uidB", "uidA")).toBe("uidA_uidB");
  });

  it("인자 순서와 무관하게 항상 같은 id를 반환한다", () => {
    expect(dmChatId("uidA", "uidB")).toBe(dmChatId("uidB", "uidA"));
  });

  it("동일한 uid 두 개를 넘기면 그 값을 한 번씩 이어붙인다", () => {
    expect(dmChatId("uidA", "uidA")).toBe("uidA_uidA");
  });
});

describe("noticeCommentsPath / chatMessagesPath", () => {
  it("공지 id로 comments 서브컬렉션 경로를 만든다", () => {
    expect(noticeCommentsPath("notice-1")).toBe("notices/notice-1/comments");
  });

  it("채팅방 id로 messages 서브컬렉션 경로를 만든다", () => {
    expect(chatMessagesPath("chat-1")).toBe("chats/chat-1/messages");
  });
});

describe("calculateLeaveBalance", () => {
  it("연차/반차 미차감 시 total 그대로 remaining을 반환한다", () => {
    expect(calculateLeaveBalance([])).toEqual({
      total: ANNUAL_LEAVE_TOTAL,
      used: 0,
      remaining: ANNUAL_LEAVE_TOTAL,
    });
  });

  it("승인/대기 상태의 연차·반차 일수를 합산해 차감한다", () => {
    const balance = calculateLeaveBalance([
      { kind: "연차", status: "승인", days: 3 },
      { kind: "반차", status: "대기", days: 0.5 },
    ]);
    expect(balance).toEqual({
      total: ANNUAL_LEAVE_TOTAL,
      used: 3.5,
      remaining: ANNUAL_LEAVE_TOTAL - 3.5,
    });
  });

  it("반려된 신청은 차감하지 않는다", () => {
    const balance = calculateLeaveBalance([
      { kind: "연차", status: "반려", days: 5 },
    ]);
    expect(balance.used).toBe(0);
    expect(balance.remaining).toBe(ANNUAL_LEAVE_TOTAL);
  });

  it("연차/반차가 아닌 종류(경조·병가·초과근무)는 차감 대상에서 제외한다", () => {
    const balance = calculateLeaveBalance([
      { kind: "경조", status: "승인", days: 5 },
      { kind: "병가", status: "승인", days: 2 },
      { kind: "초과근무", status: "승인", days: 0 },
    ]);
    expect(balance.used).toBe(0);
  });

  it("총 부여일수보다 많이 차감되어도 remaining은 0 밑으로 내려가지 않는다", () => {
    const balance = calculateLeaveBalance([
      { kind: "연차", status: "승인", days: ANNUAL_LEAVE_TOTAL + 10 },
    ]);
    expect(balance.remaining).toBe(0);
  });

  it("total을 직접 지정하면 그 값 기준으로 계산한다", () => {
    const balance = calculateLeaveBalance(
      [{ kind: "연차", status: "승인", days: 4 }],
      10,
    );
    expect(balance).toEqual({ total: 10, used: 4, remaining: 6 });
  });
});
