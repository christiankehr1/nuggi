import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows 10 attempts per 15 minutes and blocks the 11th", () => {
    const key = "ip-1";
    resetRateLimit(key);
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(key, t0 + i * 1000).ok).toBe(true);
    }
    const blocked = checkRateLimit(key, t0 + 11_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("frees up after the window passes", () => {
    const key = "ip-2";
    resetRateLimit(key);
    const t0 = 5_000_000;
    for (let i = 0; i < 10; i++) checkRateLimit(key, t0);
    expect(checkRateLimit(key, t0 + 1).ok).toBe(false);
    expect(checkRateLimit(key, t0 + 15 * 60 * 1000 + 1).ok).toBe(true);
  });

  it("keeps keys independent", () => {
    resetRateLimit("a");
    resetRateLimit("b");
    for (let i = 0; i < 10; i++) checkRateLimit("a", 0);
    expect(checkRateLimit("a", 1).ok).toBe(false);
    expect(checkRateLimit("b", 1).ok).toBe(true);
  });
});
