import { SignJWT, jwtVerify } from "jose";
import { SESSION_DAYS, SESSION_RENEW_BEFORE_DAYS } from "@/config";

/**
 * Pure session helpers (no Next.js imports) so they can be unit-tested.
 * The cookie glue lives in `src/lib/auth.ts`.
 */

export interface SessionPayload {
  familyId: string;
  memberId: string;
}

export interface DecodedSession extends SessionPayload {
  issuedAt: Date;
  expiresAt: Date;
}

const ALG = "HS256";
const DAY_MS = 24 * 60 * 60 * 1000;

function keyFor(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: SessionPayload,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + SESSION_DAYS * 24 * 60 * 60;
  return new SignJWT({ fid: payload.familyId, mid: payload.memberId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(keyFor(secret));
}

export async function verifySession(
  token: string,
  secret: string,
  now: Date = new Date(),
): Promise<DecodedSession | null> {
  try {
    const { payload } = await jwtVerify(token, keyFor(secret), {
      algorithms: [ALG],
      currentDate: now,
    });
    const fid = payload.fid;
    const mid = payload.mid;
    if (typeof fid !== "string" || typeof mid !== "string" || !payload.iat || !payload.exp) {
      return null;
    }
    return {
      familyId: fid,
      memberId: mid,
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: new Date(payload.exp * 1000),
    };
  } catch {
    return null;
  }
}

/** Sliding session: renew when fewer than SESSION_RENEW_BEFORE_DAYS remain. */
export function shouldRenew(session: DecodedSession, now: Date = new Date()): boolean {
  const remaining = session.expiresAt.getTime() - now.getTime();
  return remaining < SESSION_RENEW_BEFORE_DAYS * DAY_MS;
}

export function sessionMaxAgeSeconds(): number {
  return SESSION_DAYS * 24 * 60 * 60;
}
