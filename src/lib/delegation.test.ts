import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { delegationError, delegationRange, isActiveDelegation } from "./delegation";

describe("결재 위임 기간", () => {
  it("끝 날을 포함하도록 다음 날 00:00 까지", () => {
    const r = delegationRange("2026-11-10", "2026-11-12")!;
    expect(r.from).toEqual(new Date(2026, 10, 10));
    expect(r.until).toEqual(new Date(2026, 10, 13));
    expect(delegationRange("2026-12-31", "2026-12-31")!.until).toEqual(new Date(2027, 0, 1));
  });

  it("거꾸로이거나 형식이 틀리면 null", () => {
    expect(delegationRange("2026-11-12", "2026-11-10")).toBeNull();
    expect(delegationRange("11/10", "2026-11-10")).toBeNull();
  });

  it("지난 기간·90일 초과는 거부", () => {
    const now = new Date(2026, 10, 10, 15);
    expect(delegationError("2026-11-10", "2026-11-10", now)).toBeNull();
    expect(delegationError("2026-11-01", "2026-11-09", now)).toMatch(/지난/);
    expect(delegationError("2026-11-10", "2027-02-07", now)).toBeNull();
    expect(delegationError("2026-11-10", "2027-02-08", now)).toMatch(/최대/);
  });

  it("시작 시각부터 끝 시각 전까지만 유효", () => {
    const d = { from: Timestamp.fromMillis(1000), until: Timestamp.fromMillis(2000) };
    expect(isActiveDelegation(d, 999)).toBe(false);
    expect(isActiveDelegation(d, 1000)).toBe(true);
    expect(isActiveDelegation(d, 2000)).toBe(false);
  });
});
