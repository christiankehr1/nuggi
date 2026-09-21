import { describe, expect, it } from "vitest";
import {
  codePrefix,
  generateFamilyCode,
  hashFamilyCode,
  normalizeFamilyCode,
  verifyFamilyCode,
} from "./family-code";
import { CODE_ALPHABET } from "@/config";

describe("generateFamilyCode", () => {
  it("has the shape XXX-XXXX with the safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateFamilyCode();
      expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{4}$/);
      for (const ch of code.replace("-", "")) {
        expect(CODE_ALPHABET).toContain(ch);
      }
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it("is deterministic with an injected rng", () => {
    const rng = () => 0;
    expect(generateFamilyCode(rng)).toBe("AAA-AAAA");
    const last = () => CODE_ALPHABET.length - 1;
    expect(generateFamilyCode(last)).toBe("999-9999");
  });
});

describe("normalizeFamilyCode", () => {
  it("accepts lowercase, spaces and missing dash", () => {
    expect(normalizeFamilyCode(" nug7k2q ")).toBe("NUG-7K2Q");
    expect(normalizeFamilyCode("nug-7k2q")).toBe("NUG-7K2Q");
    expect(normalizeFamilyCode("NUG 7K2Q")).toBe("NUG-7K2Q");
  });

  it("rejects wrong length and confusable characters", () => {
    expect(normalizeFamilyCode("NUG-7K2")).toBeNull();
    expect(normalizeFamilyCode("NUG-7K2QX")).toBeNull();
    expect(normalizeFamilyCode("NUG-0K2Q")).toBeNull();
    expect(normalizeFamilyCode("NUL-7K2Q")).toBeNull();
    expect(normalizeFamilyCode("")).toBeNull();
  });
});

describe("hash + verify", () => {
  it("round-trips and rejects other codes", async () => {
    const code = "NUG-7K2Q";
    const hash = await hashFamilyCode(code);
    expect(hash).not.toContain(code);
    expect(await verifyFamilyCode(code, hash)).toBe(true);
    expect(await verifyFamilyCode("NUG-7K2R", hash)).toBe(false);
  });

  it("prefix is the first three characters", () => {
    expect(codePrefix("NUG-7K2Q")).toBe("NUG");
  });
});
