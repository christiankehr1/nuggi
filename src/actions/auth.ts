"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { de } from "@/i18n/de";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth";
import { findFamilyByCode, findOrCreateMemberForLogin } from "@/lib/db/login";
import { normalizeFamilyCode } from "@/lib/family-code";
import { checkRateLimit } from "@/lib/rate-limit";

export interface LoginState {
  error?: string;
  code?: string;
  name?: string;
}

const loginSchema = z.object({
  code: z.string().min(1),
  name: z.string().trim().min(1).max(40),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("cf-connecting-ip") ??
    "unknown"
  );
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const raw = {
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.some((i) => i.path[0] === "name");
    return { ...raw, error: nameIssue ? de.login.nameRequired : de.login.invalidCodeFormat };
  }
  const code = normalizeFamilyCode(parsed.data.code);
  if (!code) return { ...raw, error: de.login.invalidCodeFormat };

  const limit = checkRateLimit(`login:${await clientIp()}`);
  if (!limit.ok) return { ...raw, error: de.login.rateLimited };

  const family = await findFamilyByCode(code);
  if (!family) return { ...raw, error: de.login.invalidCode };

  const member = await findOrCreateMemberForLogin(family.id, parsed.data.name);
  await setSessionCookie({ familyId: family.id, memberId: member.id });
  redirect("/heute");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
