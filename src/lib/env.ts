import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ADMIN_SECRET: z.string().min(8),
  CRON_SECRET: z.string().min(8),
  VAPID_PUBLIC_KEY: z.string().min(10).optional(),
  VAPID_PRIVATE_KEY: z.string().min(10).optional(),
  VAPID_SUBJECT: z.string().min(3).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Validated environment. Throws with a readable message when something is missing.
 * Evaluated lazily so that `next build` does not require secrets.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Ungültige Umgebungsvariablen: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function pushConfigured(): boolean {
  const e = env();
  return Boolean(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT);
}
