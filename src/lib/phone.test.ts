import { afterEach, describe, expect, it, vi } from "vitest";
import { personInput } from "./schemas";
import { mobileDigits, toE164 } from "./phone";

vi.mock("server-only", () => ({}));

describe("mobileDigits", () => {
  it("keeps the 10 digits whatever prefix was typed or pasted", () => {
    for (const raw of ["9876543210", "98765 43210", "+91 98765 43210", "+91-98765-43210", "919876543210", "09876543210", "(+91) 98765.43210"]) {
      expect(mobileDigits(raw)).toBe("9876543210");
    }
  });

  it("rejects numbers that are not Indian mobiles", () => {
    expect(mobileDigits("")).toBeNull();
    expect(mobileDigits("5876543210")).toBeNull();
    expect(mobileDigits("+1 415 555 0100")).toBeNull();
    expect(mobileDigits("98765432101")).toBeNull();
  });
});

describe("toE164", () => {
  it("adds +91 to Indian mobiles and keeps other E.164 numbers", () => {
    expect(toE164("9876543210")).toBe("+919876543210");
    expect(toE164("91 98765 43210")).toBe("+919876543210");
    expect(toE164("+91 80 1234 5678")).toBe("+918012345678");
    expect(toE164("+1 415 555 0100")).toBe("+14155550100");
  });

  it("rejects values that are not phone numbers", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("12345")).toBeNull();
    expect(toE164("abc")).toBeNull();
  });
});

describe("personInput phone", () => {
  it("stores pasted +91 numbers as 10 digits", () => {
    const parsed = personInput.parse({ name: "Amma", phone: "+91 98765 43210", lang: "te-IN" });
    expect(parsed.phone).toBe("9876543210");
  });
});

describe("env phone values", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("normalises SARVAM_AGENT_PHONE and CALL_ALLOWLIST", async () => {
    vi.stubEnv("SARVAM_AGENT_PHONE", "91 80 1234 5678");
    vi.stubEnv("CALL_ALLOWLIST", "98765 43210, +91-91234-56789");
    const { env } = await import("./env");
    expect(env().SARVAM_AGENT_PHONE).toBe("+918012345678");
    expect(env().CALL_ALLOWLIST).toEqual(["+919876543210", "+919123456789"]);
  });

  it("names the bad setting without its value", async () => {
    vi.stubEnv("SARVAM_AGENT_PHONE", "not a number");
    const { env, EnvError } = await import("./env");
    expect(() => env()).toThrow(EnvError);
    try {
      env();
    } catch (err) {
      expect((err as InstanceType<typeof EnvError>).keys).toEqual(["SARVAM_AGENT_PHONE"]);
    }
  });
});
