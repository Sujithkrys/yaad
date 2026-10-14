// Step A: turn reminders that are due around now into 'scheduled' call rows.

import { inQuiet, occursOn } from "../derive";
import { dayKeyIST, istDateAt, MINUTE } from "../time";
import type { Lang, ReminderKind, Repeat, Settings } from "../types";

export const LOOKAHEAD_MS = 2 * MINUTE;
export const LOOKBACK_MS = 60 * MINUTE;

export type PlanReminder = {
  id: string;
  workspaceId: string;
  personId: string;
  kind: ReminderKind;
  text: string;
  time: string;
  repeat: Repeat;
  onceDay: string | null;
  lang: Lang | null;
  createdAt: number;
};
export type PlanPerson = { id: string; consent: "pending" | "granted"; lang: Lang; isSample: boolean };
export type ExistingCall = { reminderId: string | null; scheduledAt: number; status: string };

export type SlotRow = {
  workspace_id: string;
  reminder_id: string;
  person_id: string;
  kind: ReminderKind;
  reminder_text: string;
  lang: Lang;
  scheduled_at: string;
  status: "scheduled";
  attempt: 0;
  manual: false;
};

/**
 * Pure. Slots due within the next 2 minutes or in the last 60, that have no
 * call yet. Safe to run repeatedly: the unique (reminder_id, scheduled_at)
 * index drops anything already inserted.
 */
export function planSlots(input: {
  reminders: PlanReminder[];
  people: Map<string, PlanPerson>;
  settings: Map<string, Pick<Settings, "quietOn" | "quietFrom" | "quietTo">>;
  existing: ExistingCall[];
  now: number;
  live: boolean;
}): SlotRow[] {
  const { now } = input;
  const today = dayKeyIST(now);
  const rows: SlotRow[] = [];

  for (const r of input.reminders) {
    const p = input.people.get(r.personId);
    const s = input.settings.get(r.workspaceId);
    if (!p || !s || p.consent !== "granted" || (input.live && p.isSample)) continue;
    if (!occursOn(r, today) || inQuiet(r.time, s)) continue;

    const slot = istDateAt(today, r.time);
    if (slot > now + LOOKAHEAD_MS || slot < now - LOOKBACK_MS) continue;
    // A reminder added after its time today starts tomorrow.
    if (r.createdAt > slot) continue;

    // Skip if this reminder already has a call around this slot (scheduled, or a "Call now"),
    // or was already confirmed today.
    const sameDay = input.existing.filter((c) => c.reminderId === r.id && dayKeyIST(c.scheduledAt) === today);
    if (sameDay.some((c) => c.scheduledAt >= slot - LOOKBACK_MS || c.status === "confirmed")) continue;

    rows.push({
      workspace_id: r.workspaceId,
      reminder_id: r.id,
      person_id: r.personId,
      kind: r.kind,
      reminder_text: r.text,
      lang: r.lang ?? p.lang,
      scheduled_at: new Date(slot).toISOString(),
      status: "scheduled",
      attempt: 0,
      manual: false,
    });
  }
  return rows;
}
