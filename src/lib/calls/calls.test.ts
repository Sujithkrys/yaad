import { describe, expect, it, vi } from "vitest";
import { istDateAt } from "../time";
import { languageName, normalizePhone, openingLine } from "./format";
import { gateCall, type GateInput } from "./gate";
import { isYes, resolveOutcome } from "./resolve";
import { handleWebhook, verifyToken, type WebhookDeps } from "./webhook";

const NOW = istDateAt("2026-10-14", "19:00");
const ctx = (attemptNo: number) => ({ attemptNo, maxAttempts: 2, retryMin: 10, now: NOW });

describe("resolveOutcome", () => {
  it("confirms on yes-like answers", () => {
    for (const response of ["Yes", " taken ", "done.", "Confirmed", "le liya", "haan", "Haan ji"]) {
      const o = resolveOutcome({ status: "connected", response }, ctx(1));
      expect(o.callStatus, response).toBe("confirmed");
      expect(o.response).toBe("taken");
      expect(o.done).toBe(true);
      expect(o.alert).toBeNull();
    }
  });

  it("does not treat 'not yet' or 'no' as yes", () => {
    expect(isYes("not yet")).toBe(false);
    expect(isYes("no")).toBe(false);
    expect(isYes("nahi")).toBe(false);
  });

  it("schedules a retry when they ask for later, capped at 180 minutes", () => {
    const o = resolveOutcome({ status: "connected", response: "later", laterMinutes: 20 }, ctx(1));
    expect(o).toMatchObject({ callStatus: "retry", response: "later", laterMin: 20, nextAttemptAt: NOW + 20 * 60_000, done: false });
    expect(resolveOutcome({ status: "connected", laterMinutes: "500" }, ctx(1)).laterMin).toBe(180);
  });

  it("retries a no while attempts remain, then marks missed with an alert", () => {
    const first = resolveOutcome({ status: "connected", response: "no" }, ctx(1));
    expect(first).toMatchObject({ callStatus: "retry", response: "not_taken", nextAttemptAt: NOW + 10 * 60_000 });
    const last = resolveOutcome({ status: "connected", response: "not yet" }, ctx(2));
    expect(last).toMatchObject({ callStatus: "missed", response: "not_taken", done: true, alert: "missed" });
  });

  it("treats an unclear answer like a no", () => {
    expect(resolveOutcome({ status: "connected", response: "hmm" }, ctx(1))).toMatchObject({ callStatus: "retry", response: "unclear" });
  });

  it.each(["no_answer", "busy", "failed"] as const)("retries then misses on %s, saving the reason", (status) => {
    expect(resolveOutcome({ status }, ctx(1))).toMatchObject({ callStatus: "retry", response: "no_answer", failureReason: status });
    expect(resolveOutcome({ status, failureReason: "network" }, ctx(2))).toMatchObject({
      callStatus: "missed",
      done: true,
      alert: "missed",
      failureReason: "network",
    });
  });

  it("alerts the family when they say they are unwell, even if they took it", () => {
    for (const unwell of [true, "true", "Yes"]) {
      const o = resolveOutcome({ status: "connected", response: "yes", unwell }, ctx(1));
      expect(o.callStatus).toBe("confirmed");
      expect(o.alert).toBe("unwell");
    }
    expect(resolveOutcome({ status: "connected", response: "yes", unwell: "false" }, ctx(1)).alert).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("accepts Indian mobiles in common shapes", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalizePhone("919876543210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
  });

  it("rejects anything else", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
    expect(normalizePhone("+1 415 555 0100")).toBeNull();
    expect(normalizePhone("98765432101")).toBeNull();
  });
});

describe("language mapping", () => {
  it("maps codes to Sarvam language names", () => {
    expect(languageName("hi-IN")).toBe("Hindi");
    expect(languageName("te-IN")).toBe("Telugu");
    expect(languageName("ta")).toBe("Tamil");
    expect(languageName("kn-IN")).toBe("Kannada");
    expect(languageName("en-IN")).toBe("English");
    expect(languageName("ml-IN")).toBe("Malayalam");
    expect(languageName("xx")).toBe("Hindi");
  });

  it("opens in the person's own script", () => {
    expect(openingLine("te-IN", "Amma", "BP tablet")).toContain("నమస్కారం");
    expect(openingLine("hi-IN", "Dadi", "BP tablet")).toContain("नमस्ते");
  });
});

describe("gateCall", () => {
  const base: GateInput = {
    mode: "live",
    allowlist: ["+919876543210"],
    phone: "+919876543210",
    consent: "granted",
    manual: false,
    attemptsToday: 0,
    maxPerDay: 40,
    lastAttemptAt: null,
    settings: { quietOn: true, quietFrom: "22:00", quietTo: "06:00" },
    now: NOW,
  };

  it("dials when everything checks out", () => {
    expect(gateCall(base)).toEqual({ action: "dial" });
  });

  it("refuses numbers that are not allowlisted in live mode and marks the call failed", () => {
    expect(gateCall({ ...base, phone: "+919000000000" })).toEqual({ action: "refuse", reason: "not_allowlisted", markFailed: true });
    expect(gateCall({ ...base, mode: "simulate", phone: "+919000000000" })).toEqual({ action: "dial" });
  });

  it("refuses without consent, over the daily limit and inside the cooldown", () => {
    expect(gateCall({ ...base, consent: "pending" })).toMatchObject({ reason: "no_consent" });
    expect(gateCall({ ...base, attemptsToday: 40 })).toMatchObject({ reason: "daily_limit" });
    expect(gateCall({ ...base, lastAttemptAt: NOW - 60_000 })).toMatchObject({ reason: "cooldown" });
    expect(gateCall({ ...base, lastAttemptAt: NOW - 3 * 60_000 })).toEqual({ action: "dial" });
  });

  it("reschedules scheduled calls in quiet hours to when they end", () => {
    const late = istDateAt("2026-10-14", "23:15");
    expect(gateCall({ ...base, now: late })).toEqual({ action: "reschedule", at: istDateAt("2026-10-15", "06:00") });
    const early = istDateAt("2026-10-15", "05:00");
    expect(gateCall({ ...base, now: early })).toEqual({ action: "reschedule", at: istDateAt("2026-10-15", "06:00") });
    // A manual "Call now" is the family's choice and is not held back.
    expect(gateCall({ ...base, now: late, manual: true })).toEqual({ action: "dial" });
  });
});

describe("webhook", () => {
  const secret = "s".repeat(40);
  const payload = {
    attempt_id: "att_1",
    status: "connected",
    duration: 31,
    final_agent_variables: { response: "yes" },
    interaction_transcript: [{ role: "agent", en_text: "Did you take it?" }],
    extra_field: { ignored: true },
  };

  function deps(claimResult: Awaited<ReturnType<WebhookDeps["claimAttempt"]>>) {
    return {
      secret,
      claimAttempt: vi.fn().mockResolvedValue(claimResult),
      applyResult: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("rejects a wrong or missing token with 401", async () => {
    const d = deps({ callId: "c", workspaceId: "w", attemptNo: 1 });
    expect((await handleWebhook(null, payload, d)).status).toBe(401);
    expect((await handleWebhook("wrong", payload, d)).status).toBe(401);
    expect((await handleWebhook("s".repeat(39) + "x", payload, d)).status).toBe(401);
    expect(d.claimAttempt).not.toHaveBeenCalled();
    expect(verifyToken(secret, secret)).toBe(true);
  });

  it("applies a first delivery", async () => {
    const d = deps({ callId: "c", workspaceId: "w", attemptNo: 1 });
    expect(await handleWebhook(secret, payload, d)).toEqual({ status: 200, body: { ok: true } });
    expect(d.applyResult).toHaveBeenCalledTimes(1);
  });

  it("acknowledges duplicates and unknown attempts without applying anything", async () => {
    const d = deps(null);
    expect(await handleWebhook(secret, payload, d)).toEqual({ status: 200, body: { ok: true } });
    expect(d.claimAttempt).toHaveBeenCalledWith("att_1", expect.objectContaining({ status: "connected" }));
    expect(d.applyResult).not.toHaveBeenCalled();
  });

  it("returns 400 for a payload without an attempt id", async () => {
    expect((await handleWebhook(secret, { status: "connected" }, deps(null))).status).toBe(400);
  });
});
