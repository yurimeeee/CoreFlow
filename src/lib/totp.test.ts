import { describe, expect, it } from "vitest";
import { matchTotpStep, totpAt } from "./totp";

// RFC 6238 부록 B 의 SHA-1 시크릿("12345678901234567890")을 base32 로
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("matchTotpStep", () => {
  it("RFC 6238 테스트 벡터와 같은 코드를 만든다", async () => {
    expect(await totpAt(SECRET, 59_000)).toBe("287082");
    expect(await totpAt(SECRET, 1_111_111_109_000)).toBe("081804");
  });

  it("맞는 코드면 그 코드의 30초 카운터를 돌려준다", async () => {
    expect(await matchTotpStep(SECRET, "287082", 1, 59_000)).toBe(1);
  });

  it("±1 스텝까지 허용하고, 그 밖이거나 형식이 틀리면 null", async () => {
    expect(await matchTotpStep(SECRET, "287082", 1, 89_000)).toBe(1);
    expect(await matchTotpStep(SECRET, "287082", 1, 120_000)).toBeNull();
    expect(await matchTotpStep(SECRET, "28708", 1, 59_000)).toBeNull();
  });
});
