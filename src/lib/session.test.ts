import { describe, expect, it } from "vitest";
import { sessionMaxAgeSeconds, shouldRenew, signSession, verifySession } from "./session";
import { SESSION_DAYS } from "@/config";

const SECRET = "a".repeat(48);
const OTHER = "b".repeat(48);
const payload = { familyId: "fam-1", memberId: "mem-1" };

describe("session", () => {
  it("signs and verifies a session", async () => {
    const now = new Date("2026-09-21T10:00:00Z");
    const token = await signSession(payload, SECRET, now);
    const decoded = await verifySession(token, SECRET, now);
    expect(decoded?.familyId).toBe("fam-1");
    expect(decoded?.memberId).toBe("mem-1");
    expect(decoded?.expiresAt.getTime()).toBe(now.getTime() + SESSION_DAYS * 86_400_000);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession(payload, SECRET);
    expect(await verifySession(token, OTHER)).toBeNull();
  });

  it("rejects tampered and garbage tokens", async () => {
    const token = await signSession(payload, SECRET);
    const [h, p, s] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ fid: "fam-2", mid: "mem-1" })).toString(
      "base64url",
    );
    expect(await verifySession(`${h}.${tamperedPayload}.${s}`, SECRET)).toBeNull();
    expect(await verifySession(`${h}.${p}.`, SECRET)).toBeNull();
    expect(await verifySession("not-a-token", SECRET)).toBeNull();
  });

  it("expires after 180 days", async () => {
    const issued = new Date("2026-01-01T00:00:00Z");
    const token = await signSession(payload, SECRET, issued);
    const later = new Date(issued.getTime() + (SESSION_DAYS + 1) * 86_400_000);
    expect(await verifySession(token, SECRET, later)).toBeNull();
  });

  it("slides: wants renewal after 30 days, not on day 1", async () => {
    const issued = new Date("2026-01-01T00:00:00Z");
    const token = await signSession(payload, SECRET, issued);
    const fresh = (await verifySession(token, SECRET, issued))!;
    expect(shouldRenew(fresh, issued)).toBe(false);
    const day40 = new Date(issued.getTime() + 40 * 86_400_000);
    expect(shouldRenew(fresh, day40)).toBe(true);
  });

  it("exposes the cookie max age in seconds", () => {
    expect(sessionMaxAgeSeconds()).toBe(SESSION_DAYS * 86_400);
  });
});
