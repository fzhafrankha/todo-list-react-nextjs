import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/auth/rateLimit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit", () => {
    const key = `test-key-${Math.random()}`;

    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
  });

  it("blocks requests once the limit is exceeded within the window", () => {
    const key = `test-key-${Math.random()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);

    const blocked = checkRateLimit(key, 2, 60_000);

    expect(blocked).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const keyA = `key-a-${Math.random()}`;
    const keyB = `key-b-${Math.random()}`;
    checkRateLimit(keyA, 1, 60_000);

    expect(checkRateLimit(keyA, 1, 60_000)).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000)).toBe(true);
  });
});
