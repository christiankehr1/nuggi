import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/config";
import { env } from "@/lib/env";
import type { FamilyScope } from "@/lib/db/withFamily";
import { sessionMaxAgeSeconds, signSession, verifySession } from "@/lib/session";

/**
 * Cookie glue around the pure session helpers.
 * `requireSession()` is the ONLY source of a FamilyScope in the app.
 */

export async function getSession(): Promise<FamilyScope | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const decoded = await verifySession(token, env().SESSION_SECRET);
  if (!decoded) return null;
  return { familyId: decoded.familyId, memberId: decoded.memberId };
}

export async function requireSession(): Promise<FamilyScope> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function setSessionCookie(scope: FamilyScope): Promise<void> {
  const token = await signSession(scope, env().SESSION_SECRET);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
