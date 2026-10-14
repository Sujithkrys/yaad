// Pure safety gate run before any call is placed.

import { inQuiet } from "../derive";
import { addDaysIST, dayKeyIST, hhmmIST, istDateAt } from "../time";
import type { Settings } from "../types";

export const COOLDOWN_MS = 2 * 60_000;

export type GateInput = {
  mode: "live" | "simulate";
  allowlist: string[];
  /** E.164 or null when the stored number cannot be normalised */
  phone: string | null;
  consent: "pending" | "granted";
  manual: boolean;
  attemptsToday: number;
  maxPerDay: number;
  /** last attempt to this person, epoch ms */
  lastAttemptAt: number | null;
  settings: Pick<Settings, "quietOn" | "quietFrom" | "quietTo">;
  now: number;
};

export type GateDecision =
  | { action: "dial" }
  | { action: "refuse"; reason: "no_consent" | "bad_phone" | "not_allowlisted" | "daily_limit" | "cooldown"; markFailed: boolean }
  | { action: "reschedule"; at: number };

/** When quiet hours end next, as epoch ms (IST). */
export function quietEndAfter(now: number, quietTo: string) {
  const today = istDateAt(dayKeyIST(now), quietTo);
  return today > now ? today : istDateAt(addDaysIST(now, 1), quietTo);
}

export function gateCall(g: GateInput): GateDecision {
  if (g.consent !== "granted") return { action: "refuse", reason: "no_consent", markFailed: false };
  if (!g.phone) return { action: "refuse", reason: "bad_phone", markFailed: true };
  if (g.mode === "live" && !g.allowlist.includes(g.phone)) return { action: "refuse", reason: "not_allowlisted", markFailed: true };
  if (g.attemptsToday >= g.maxPerDay) return { action: "refuse", reason: "daily_limit", markFailed: false };
  if (g.lastAttemptAt !== null && g.now - g.lastAttemptAt < COOLDOWN_MS) return { action: "refuse", reason: "cooldown", markFailed: false };
  if (!g.manual && inQuiet(hhmmIST(g.now), g.settings)) return { action: "reschedule", at: quietEndAfter(g.now, g.settings.quietTo) };
  return { action: "dial" };
}
