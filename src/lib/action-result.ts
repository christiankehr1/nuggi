/**
 * Uniform result type for server actions so client code (and the offline
 * outbox) can handle success/failure without try/catch around RSC calls.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "validation" | "conflict" | "not_found" | "unknown" };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(
  error: string,
  code: NonNullable<Extract<ActionResult<T>, { ok: false }>["code"]> = "unknown",
): ActionResult<T> {
  return { ok: false, error, code };
}
