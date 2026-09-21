import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/config";
import { sessionMaxAgeSeconds, shouldRenew, signSession, verifySession } from "@/lib/session";

/**
 * Optimistic route guard + sliding session renewal + admin basic auth.
 * Real authorization happens in every server action via requireSession().
 */

const APP_PREFIXES = ["/heute", "/verlauf", "/statistik", "/einstellungen"];

function unauthorizedAdmin(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Nuggi Admin", charset="UTF-8"' },
  });
}

function adminAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    const password = idx >= 0 ? decoded.slice(idx + 1) : decoded;
    return timingSafeEqual(password, secret);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    return adminAuthorized(request) ? NextResponse.next() : unauthorizedAdmin();
  }

  const isApp = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isLogin = pathname === "/login";
  if (!isApp && !isLogin) return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token && secret ? await verifySession(token, secret) : null;

  if (isLogin) {
    return session ? NextResponse.redirect(new URL("/heute", request.url)) : NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  if (secret && shouldRenew(session)) {
    const fresh = await signSession(
      { familyId: session.familyId, memberId: session.memberId },
      secret,
    );
    response.cookies.set(SESSION_COOKIE, fresh, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionMaxAgeSeconds(),
    });
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/heute/:path*", "/verlauf/:path*", "/statistik/:path*", "/einstellungen/:path*", "/login"],
};
