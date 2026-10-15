import "server-only";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { ApiError } from "../api-error";
import { transcriptFor } from "../conversation";
import { getSettings } from "../db/repo";
import { env } from "../env";
import { placeCall, SarvamError } from "../sarvam";
import { supabaseAdmin } from "../supabase-admin";
import { addDaysIST, dayKeyIST, istDateAt } from "../time";
import type { Lang, Settings } from "../types";
import type { Workspace as Account } from "../workspace";

/** Dialling only needs the account id and its name (the person who set the reminder). */
type Workspace = Pick<Account, "id" | "name">;
import { applyResult, claimAttempt } from "./apply";
import { languageName, normalizePhone, openingLine } from "./format";
import { COOLDOWN_MS, gateCall, type GateDecision, type RefuseReason } from "./gate";
import type { WebhookPayload } from "./webhook";

export type DialResult =
  | { status: "calling"; callId: string; mode: "live" | "simulate"; message: string }
  | { status: "rescheduled"; callId: string; at: number; message: string }
  | { status: "skipped"; callId: string; reason: RefuseReason; message: string }
  | { status: "failed"; callId: string; message: string };

type PersonRow = { id: string; name: string; phone: string; lang: Lang; consent: "pending" | "granted"; is_sample: boolean };
type Pending = "scheduled" | "retry";

export const DEMO_LIMIT = "Demo limit reached for today.";

const REFUSAL: Record<RefuseReason, (name: string) => [number, string]> = {
  no_consent: (n) => [409, `${n} has not agreed to calls yet.`],
  bad_phone: (n) => [400, `${n}'s mobile number cannot be called.`],
  not_allowlisted: (n) => [403, `${n}'s number is not on the call allowlist, so no call was placed.`],
  sample_person: (n) => [409, `${n} is from the sample data, so no real call was placed. Add a real family member to try a call.`],
  daily_limit: () => [429, DEMO_LIMIT],
  cooldown: (n) => [429, `${n} was called a moment ago. Wait two minutes and try again.`],
};

async function gateFor(ws: Workspace, person: PersonRow, manual: boolean, settings: Settings) {
  const e = env();
  const db = supabaseAdmin();
  const now = Date.now();
  const midnight = new Date(istDateAt(dayKeyIST(now), "00:00")).toISOString();

  const [global, mine, last] = await Promise.all([
    // The global cap protects call credits, so it counts every workspace.
    db.from("call_attempts").select("id", { count: "exact", head: true }).gte("created_at", midnight),
    db.from("call_attempts").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).gte("created_at", midnight),
    // Cooldown is per number, whoever added it.
    db
      .from("call_attempts")
      .select("created_at, calls!inner(people!inner(phone))")
      .eq("calls.people.phone", person.phone)
      .gte("created_at", new Date(now - COOLDOWN_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (global.error || mine.error || last.error) throw new ApiError(500, "Could not check the call limits. Try again.");

  return gateCall({
    mode: e.CALL_MODE,
    allowlist: e.CALL_ALLOWLIST,
    phone: normalizePhone(person.phone),
    consent: person.consent,
    isSample: person.is_sample,
    manual,
    attemptsToday: global.count ?? 0,
    maxPerDay: e.MAX_CALLS_PER_DAY,
    workspaceAttemptsToday: mine.count ?? 0,
    maxPerWorkspace: e.MAX_CALLS_PER_WORKSPACE_PER_DAY,
    lastAttemptAt: last.data?.[0] ? new Date(last.data[0].created_at).getTime() : null,
    settings,
    now,
  });
}

/**
 * Handles a refusal. Permanent refusals mark the call missed (not retried).
 * For a manual press, throws a user-facing error; for the scheduler, returns a result.
 */
async function refuse(
  decision: Extract<GateDecision, { action: "refuse" }>,
  person: PersonRow,
  ws: Workspace,
  callId: string | null,
  claimed: Pending | null,
): Promise<DialResult> {
  const db = supabaseAdmin();
  const [status, message] = REFUSAL[decision.reason](person.name);
  if (callId && (decision.markFailed || (claimed && decision.reason === "no_consent"))) {
    await db
      .from("calls")
      .update({ status: "missed", failure_reason: decision.reason, done_at: new Date().toISOString(), next_attempt_at: null })
      .eq("id", callId)
      .eq("workspace_id", ws.id);
  } else if (callId && claimed) {
    // Cooldown: put it back and try again shortly.
    await db
      .from("calls")
      .update({ status: claimed, next_attempt_at: new Date(Date.now() + COOLDOWN_MS).toISOString() })
      .eq("id", callId)
      .eq("workspace_id", ws.id);
  }
  if (!claimed) throw new ApiError(status, message);
  return { status: "skipped", callId: callId ?? "", reason: decision.reason, message };
}

/** A believable result for CALL_MODE=simulate, following settings.demo_outcome. */
function simulatedPayload(attemptId: string, settings: Settings, lang: Lang, name: string, reminder: string): WebhookPayload {
  const r = Math.random();
  const kind =
    settings.demoOutcome === "taken" ? "taken" : settings.demoOutcome === "noanswer" ? "no_answer" : r < 0.6 ? "taken" : r < 0.75 ? "later" : r < 0.85 ? "not_taken" : "no_answer";
  const lines = kind === "no_answer" ? [] : transcriptFor(lang, name, reminder, kind);
  return {
    attempt_id: attemptId,
    status: kind === "no_answer" ? "no_answer" : "connected",
    duration: kind === "no_answer" ? 0 : 24 + Math.floor(Math.random() * 20),
    interaction_id: `sim_${randomUUID()}`,
    failure_reason: kind === "no_answer" ? "no_answer" : null,
    final_agent_variables:
      kind === "no_answer"
        ? null
        : {
            response: kind === "taken" ? "yes" : kind === "later" ? "later" : "no",
            later_minutes: kind === "later" ? 10 : null,
            unwell: false,
            call_summary:
              kind === "taken"
                ? `${name} confirmed the ${reminder}.`
                : kind === "later"
                  ? `${name} will do the ${reminder} in about 10 minutes.`
                  : `${name} has not done the ${reminder} yet.`,
          },
    interaction_transcript: lines.map((l) => ({ role: l.role === "agent" ? "agent" : "user", en_text: l.english, text: l.native })),
    webhook_config: null,
  };
}

/**
 * Dials a call row. Used by "Call now", "Call again", the setup test call and
 * the scheduler. The scheduler passes `claimed` after atomically moving the
 * row to 'calling', so the in-progress check is skipped.
 */
export async function dialCall(ws: Workspace, callId: string, opts: { manual: boolean; claimed?: Pending }): Promise<DialResult> {
  const db = supabaseAdmin();
  const claimed = opts.claimed ?? null;
  const { data: call, error } = await db
    .from("calls")
    .select("id, status, attempt, kind, reminder_text, lang, person_id, people(id, name, phone, lang, consent, is_sample)")
    .eq("workspace_id", ws.id)
    .eq("id", callId)
    .maybeSingle();
  if (error) throw new ApiError(500, "Could not load the call. Try again.");
  if (!call) throw new ApiError(404, "That call was not found.");
  const person = call.people as unknown as PersonRow | null;
  if (!person) throw new ApiError(404, "That person was not found.");
  if (!claimed && call.status === "calling") throw new ApiError(409, `${person.name} is already being called.`);

  const settings = await getSettings(ws.id);
  const decision = await gateFor(ws, person, opts.manual, settings);
  if (decision.action === "refuse") return refuse(decision, person, ws, call.id, claimed);

  if (decision.action === "reschedule") {
    // next_attempt_at, not scheduled_at: the slot keeps its identity, so the scheduler never re-creates it.
    const back: Pending = claimed ?? ((call.attempt ?? 0) > 0 ? "retry" : "scheduled");
    await db.from("calls").update({ status: back, next_attempt_at: new Date(decision.at).toISOString() }).eq("id", call.id).eq("workspace_id", ws.id);
    return { status: "rescheduled", callId: call.id, at: decision.at, message: `Quiet hours are on, so ${person.name} will be called when they end.` };
  }

  const e = env();
  const attemptNo = (call.attempt ?? 0) + 1;
  const lang = (call.lang ?? person.lang) as Lang;

  // Record the attempt before calling, so a webhook can never arrive for an unknown attempt.
  const { data: attempt, error: aErr } = await db
    .from("call_attempts")
    .insert({ workspace_id: ws.id, call_id: call.id, attempt_no: attemptNo, status: "dialing" })
    .select("id")
    .single();
  if (aErr || !attempt) {
    if (claimed) await db.from("calls").update({ status: claimed }).eq("id", call.id).eq("workspace_id", ws.id);
    throw new ApiError(500, "Could not start the call. Try again.");
  }
  await db
    .from("calls")
    .update({ status: "calling", attempt: attemptNo, next_attempt_at: null, failure_reason: null, ...(opts.manual ? { manual: true } : {}) })
    .eq("id", call.id)
    .eq("workspace_id", ws.id);

  if (e.CALL_MODE === "simulate") {
    const simId = `sim_${randomUUID()}`;
    await db.from("call_attempts").update({ sarvam_attempt_id: simId }).eq("id", attempt.id);
    const payload = simulatedPayload(simId, settings, lang, person.name, call.reminder_text);
    after(async () => {
      await new Promise((r) => setTimeout(r, 6000 + Math.random() * 4000));
      try {
        const got = await claimAttempt(simId, payload);
        if (got) await applyResult(got, payload);
      } catch (err) {
        console.error("[calls] simulated result failed", (err as Error).message);
      }
    });
    return { status: "calling", callId: call.id, mode: "simulate", message: `Calling ${person.name} (simulated).` };
  }

  try {
    const { attemptId } = await placeCall({
      phone: normalizePhone(person.phone)!,
      languageName: languageName(lang),
      openingLine: openingLine(lang, person.name, call.reminder_text),
      variables: {
        person_name: person.name,
        reminder_text: call.reminder_text,
        requester_name: ws.name || "your family",
        user_name: ws.name || "your family",
      },
      metadata: { call_id: call.id, attempt_no: attemptNo, workspace_id: ws.id },
    });
    await db.from("call_attempts").update({ sarvam_attempt_id: attemptId }).eq("id", attempt.id);
    return { status: "calling", callId: call.id, mode: "live", message: `Calling ${person.name} now.` };
  } catch (err) {
    const reason = err instanceof SarvamError ? `sarvam_${err.status || "network"}` : "dial_error";
    console.error("[calls] placeCall failed", reason, err instanceof SarvamError ? err.body.slice(0, 200) : (err as Error).message);
    const failId = `failed_${attempt.id}`;
    await db.from("call_attempts").update({ sarvam_attempt_id: failId }).eq("id", attempt.id);
    const payload: WebhookPayload = { attempt_id: failId, status: "failed", failure_reason: reason };
    const got = await claimAttempt(failId, payload);
    if (got) await applyResult(got, payload);
    return { status: "failed", callId: call.id, message: `The call to ${person.name} could not be placed. Try again in a few minutes.` };
  }
}

/** "Call now" from the dashboard: dials today's call for a reminder, creating it if needed. */
export async function callReminderNow(ws: Workspace, reminderId: string): Promise<DialResult> {
  const db = supabaseAdmin();
  const { data: r, error } = await db
    .from("reminders")
    .select("id, kind, reminder_text, lang, person_id, people(id, name, phone, lang, consent, is_sample)")
    .eq("workspace_id", ws.id)
    .eq("id", reminderId)
    .maybeSingle();
  if (error) throw new ApiError(500, "Could not load the reminder. Try again.");
  if (!r) throw new ApiError(404, "That reminder was not found.");
  const person = r.people as unknown as PersonRow | null;
  if (!person) throw new ApiError(404, "That person was not found.");

  const now = Date.now();
  const from = new Date(istDateAt(dayKeyIST(now), "00:00")).toISOString();
  const to = new Date(istDateAt(addDaysIST(now, 1), "00:00")).toISOString();
  const { data: existing } = await db
    .from("calls")
    .select("id, status")
    .eq("workspace_id", ws.id)
    .eq("reminder_id", r.id)
    .gte("scheduled_at", from)
    .lt("scheduled_at", to)
    .order("created_at", { ascending: false })
    .limit(1);
  const today = existing?.[0];
  if (today?.status === "confirmed") throw new ApiError(409, `${person.name} already confirmed this today.`);
  if (today) return dialCall(ws, today.id, { manual: true });

  // Check the gate before creating a row, so refusals leave nothing behind.
  const settings = await getSettings(ws.id);
  const decision = await gateFor(ws, person, true, settings);
  if (decision.action === "refuse") return refuse(decision, person, ws, null, null);

  const { data: call, error: cErr } = await db
    .from("calls")
    .insert({
      workspace_id: ws.id,
      reminder_id: r.id,
      person_id: person.id,
      kind: r.kind,
      reminder_text: r.reminder_text,
      lang: r.lang ?? person.lang,
      scheduled_at: new Date(now).toISOString(),
      status: "scheduled",
      attempt: 0,
      manual: true,
    })
    .select("id")
    .single();
  if (cErr || !call) throw new ApiError(500, "Could not start the call. Try again.");
  return dialCall(ws, call.id, { manual: true });
}
