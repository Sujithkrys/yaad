// Pure: decides whether a call needs a family alert, and what it says.
// Messages are plain and calm, and never give medical advice.

import { fmtTs } from "../time";

export type AlertKind = "missed" | "unwell" | "info";

export type AlertCandidate = {
  id: string;
  workspaceId: string;
  personId: string;
  personName: string;
  reminderText: string;
  scheduledAt: number;
  status: string;
  attempt: number;
  response: string | null;
  failureReason: string | null;
  unwell: boolean;
  alerted: boolean;
};

/** Missed for these reasons means no call was made, so there is nothing to tell the family. */
const NOT_A_REAL_MISS = new Set(["daily_limit", "no_consent", "sample_person", "not_allowlisted", "bad_phone"]);

export function alertFor(c: AlertCandidate): { kind: AlertKind; message: string } | null {
  if (c.alerted) return null;
  const when = fmtTs(c.scheduledAt);
  if (c.unwell) {
    return { kind: "unwell", message: `${c.personName} said they are not feeling well during the ${when} call. Please check in.` };
  }
  if (c.status === "missed" && !NOT_A_REAL_MISS.has(c.failureReason ?? "")) {
    const calls = `${c.attempt} ${c.attempt === 1 ? "attempt" : "attempts"}`;
    if (c.response === "not_taken") {
      return { kind: "missed", message: `${c.personName} said they have not done the ${when} ${c.reminderText} yet (${calls}).` };
    }
    return { kind: "missed", message: `${c.personName} did not pick up the ${when} ${c.reminderText} reminder (${calls}).` };
  }
  if (c.status === "confirmed" && c.attempt > 3) {
    return { kind: "info", message: `${c.personName} confirmed the ${when} ${c.reminderText} after ${c.attempt - 1} retries.` };
  }
  return null;
}

export type AlertDeps = {
  listCandidates: () => Promise<AlertCandidate[]>;
  /** UPDATE ... SET alerted=true WHERE id=$1 AND alerted=false RETURNING. True when this caller won. */
  claim: (callId: string) => Promise<boolean>;
  send: (c: AlertCandidate, alert: { kind: AlertKind; message: string }) => Promise<void>;
};

/** Sends each alert at most once, even when several ticks or webhooks run together. */
export async function processAlerts(deps: AlertDeps) {
  let sent = 0;
  for (const c of await deps.listCandidates()) {
    const alert = alertFor(c);
    if (!alert) continue;
    if (!(await deps.claim(c.id))) continue;
    try {
      await deps.send(c, alert);
      sent++;
    } catch (err) {
      console.error("[alerts] send failed", (err as Error).message);
    }
  }
  return sent;
}
