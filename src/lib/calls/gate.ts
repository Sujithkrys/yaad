// Pure safety gate run before any call is placed.

import { inQuiet } from "../derive";
import { addDaysIST, dayKeyIST, hhmmIST, istDateAt } from "../time";
import type { Settings } from "../types";

export const COOLDOWN_MS = 2 * 60_000;

export type GateInput = {
  mode: "live" | "simulate";
  /** Empty means open mode: any valid number may be called. */
  allowlist: string[];
  /** E.164 or null when the stored number cannot be normalised */
  phone: string | null;
  consent: "pending" | "granted";
  /** Sample family members are never dialled for real. */
  isSample: boolean;
  manual: boolean;
  /** Attempts since IST midnight across all workspaces. */
  attemptsToday: number;
  maxPerDay: number;
  /** Attempts since IST midnight in this workspace. */
  workspaceAttemptsToday: number;
  maxPerWorkspace: number;
  /** last attempt to this number, epoch ms */
  lastAttemptAt: number | null;
  settings: Pick<Settings, "quietOn" | "quietFrom" | "quietTo">;
  now: number;
};

export type RefuseReason = "no_consent" | "bad_phone" | "not_allowlisted" | "sample_person" | "daily_limit" | "cooldown";

export type GateDecision =
  | { action: "dial" }
  | { action: "refuse"; reason: RefuseReason; markFailed: boolean }
  | { action: "reschedule"; at: number };

/** When quiet hours end next, as epoch ms (IST). */
export function quietEndAfter(now: number, quietTo: string) {
  const today = istDateAt(dayKeyIST(now), quietTo);
  return today > now ? today : istDateAt(addDaysIST(now, 1), quietTo);
}

export function gateCall(g: GateInput): GateDecision {
  if (g.consent !== "granted") return { action: "refuse", reason: "no_consent", markFailed: false };
  if (!g.phone) return { action: "refuse", reason: "bad_phone", markFailed: true };
  if (g.mode === "live" && g.isSample) return { action: "refuse", reason: "sample_person", markFailed: true };
  if (g.mode === "live" && g.allowlist.length > 0 && !g.allowlist.includes(g.phone)) {
    return { action: "refuse", reason: "not_allowlisted", markFailed: true };
  }
  if (g.attemptsToday >= g.maxPerDay || g.workspaceAttemptsToday >= g.maxPerWorkspace) {
    return { action: "refuse", reason: "daily_limit", markFailed: true };
  }
  if (g.lastAttemptAt !== null && g.now - g.lastAttemptAt < COOLDOWN_MS) return { action: "refuse", reason: "cooldown", markFailed: false };
  if (!g.manual && inQuiet(hhmmIST(g.now), g.settings)) return { action: "reschedule", at: quietEndAfter(g.now, g.settings.quietTo) };
  return { action: "dial" };
}
