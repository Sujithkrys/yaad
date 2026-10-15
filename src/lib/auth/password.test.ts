import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("amma-bp-7pm");
    expect(stored.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("amma-bp-7pm", stored)).toBe(true);
    expect(await verifyPassword("amma-bp-7PM", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same-password")).not.toBe(await hashPassword("same-password"));
  });

  it("handles missing or malformed hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "plain-text")).toBe(false);
    expect(await verifyPassword("x", DUMMY_HASH)).toBe(false);
  });

  it("treats composed and decomposed Unicode the same", async () => {
    const stored = await hashPassword("café-పాస్");
    expect(await verifyPassword("café-పాస్", stored)).toBe(true);
  });
});
