import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { CODE_ALPHABET, CODE_PREFIX_LENGTH, CODE_SUFFIX_LENGTH } from "@/config";

const BCRYPT_ROUNDS = 10;

function randomChars(length: number, rng: (max: number) => number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[rng(CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Generate a family code like `WAL-7K2Q`.
 * Uses a CSPRNG by default; `rng` can be injected for deterministic tests.
 */
export function generateFamilyCode(rng: (max: number) => number = randomInt): string {
  return `${randomChars(CODE_PREFIX_LENGTH, rng)}-${randomChars(CODE_SUFFIX_LENGTH, rng)}`;
}

/**
 * Normalise user input: trim, uppercase, strip everything but alphanumerics,
 * and re-insert the dash. Returns null when the shape is not XXX-XXXX or
 * contains characters outside the alphabet.
 */
export function normalizeFamilyCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== CODE_PREFIX_LENGTH + CODE_SUFFIX_LENGTH) return null;
  for (const ch of cleaned) {
    if (!CODE_ALPHABET.includes(ch)) return null;
  }
  return `${cleaned.slice(0, CODE_PREFIX_LENGTH)}-${cleaned.slice(CODE_PREFIX_LENGTH)}`;
}

export function codePrefix(code: string): string {
  return code.slice(0, CODE_PREFIX_LENGTH);
}

export async function hashFamilyCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

export async function verifyFamilyCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
