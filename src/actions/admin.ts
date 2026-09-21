"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminCreateFamily, adminDeleteFamily } from "@/lib/db/admin";
import { env } from "@/lib/env";

/**
 * Admin actions. The proxy already enforces basic auth on /admin, but server
 * actions are reachable by POST from anywhere, so we re-check the header here.
 */
async function assertAdmin(): Promise<void> {
  const header = (await headers()).get("authorization") ?? "";
  if (!header.startsWith("Basic ")) throw new Error("Unauthorized");
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const password = decoded.slice(decoded.indexOf(":") + 1);
  if (password !== env().ADMIN_SECRET) throw new Error("Unauthorized");
}

export interface CreateFamilyState {
  error?: string;
  created?: { name: string; code: string };
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  timezone: z.string().trim().min(3).max(64).default("Europe/Zurich"),
});

export async function createFamilyAction(
  _prev: CreateFamilyState,
  formData: FormData,
): Promise<CreateFamilyState> {
  await assertAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone") || undefined,
  });
  if (!parsed.success) return { error: "Bitte einen Namen mit mindestens 2 Zeichen angeben." };
  const { family, code } = await adminCreateFamily(parsed.data.name, parsed.data.timezone);
  revalidatePath("/admin");
  return { created: { name: family.name, code } };
}

export async function deleteFamilyAction(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  await adminDeleteFamily(id);
  revalidatePath("/admin");
}
