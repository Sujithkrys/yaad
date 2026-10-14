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
import type { Workspace } from "../workspace";
import { applyResult, claimAttempt } from "./apply";
import { languageName, normalizePhone, openingLine } from "./format";
import { gateCall, type GateDecision } from "./gate";
import type { WebhookPayload } from "./webhook";

export type DialResult =
  | { status: "calling"; callId: string; mode: "live" | "simulate"; message: string }
  | { status: "rescheduled"; callId: string; at: number; message: string }
  | { status: "failed"; callId: string; message: string };

type PersonRow = { id: string; name: string; phone: string; lang: Lang; consent: "pending" | "granted" };

const REFUSAL: Record<Exclude<GateDecision, { action: "dial" } | { action: "reschedule" }>["reason"], (name: string) => [number, string]> = {
  no_consent: (n) => [409, `${n} has not agreed to calls yet.`],
  bad_phone: (n) => [400, `${n}'s mobile number cannot be called.`],
  not_allowlisted: (n) => [403, `${n}'s number is not on the call allowlist, so no call was placed.`],
  daily_limit: () => [429, "Today's call limit is reached. Try again tomorrow."],
  cooldown: (n) => [429, `${n} was called a moment ago. Wait two minutes and try again.`],
};

async function gateFor(person: PersonRow, manual: boolean, settings: Settings) {
  const e = env();
  const db = supabaseAdmin();
  const now = Date.now();
  const midnight = new Date(istDateAt(dayKeyIST(now), "00:00")).toISOString();

  // The daily limit protects call credits, so it counts every workspace.
  const today = await db.from("call_attempts").select("id", { count: "exact", head: true }).gte("created_at", midnight);
  const last = await db
    .from("call_attempts")
    .select("created_at, calls!inner(person_id)")
    .eq("calls.person_id", person.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (today.error || last.error) throw new ApiError(500, "Could not check the call limits. Try again.");

  return gateCall({
    mode: e.CALL_MODE,
    allowlist: e.CALL_ALLOWLIST,
    phone: normalizePhone(person.phone),
    consent: person.consent,
    manual,
    attemptsToday: today.count ?? 0,
    maxPerDay: e.MAX_CALLS_PER_DAY,
    lastAttemptAt: last.data?.[0] ? new Date(last.data[0].created_at).getTime() : null,
    settings,
    now,
  });
}

/** Throws for refusals; marks the call failed first when the refusal is permanent. */
async function enforce(decision: GateDecision, person: PersonRow, ws: Workspace, callId: string | null) {
  if (decision.action !== "refuse") return;
  if (decision.markFailed && callId) {
    await supabaseAdmin()
      .from("calls")
      .update({ status: "missed", failure_reason: decision.reason, done_at: new Date().toISOString() })
      .eq("id", callId)
      .eq("workspace_id", ws.id);
  }
  const [status, message] = REFUSAL[decision.reason](person.name);
  throw new ApiError(status, message);
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

/** Dials an existing call row. Used by "Call now", "Call again" and the setup test call. */
export async function dialCall(ws: Workspace, callId: string, opts: { manual: boolean }): Promise<DialResult> {
  const db = supabaseAdmin();
  const { data: call, error } = await db
    .from("calls")
    .select("id, status, attempt, kind, reminder_text, lang, person_id, people(id, name, phone, lang, consent)")
    .eq("workspace_id", ws.id)
    .eq("id", callId)
    .maybeSingle();
  if (error) throw new ApiError(500, "Could not load the call. Try again.");
  if (!call) throw new ApiError(404, "That call was not found.");
  const person = call.people as unknown as PersonRow | null;
  if (!person) throw new ApiError(404, "That person was not found.");
  if (call.status === "calling") throw new ApiError(409, `${person.name} is already being called.`);
  if (call.status === "confirmed" && !opts.manual) throw new ApiError(409, "This reminder is already confirmed.");

  const settings = await getSettings(ws.id);
  const decision = await gateFor(person, opts.manual, settings);
  await enforce(decision, person, ws, call.id);

  if (decision.action === "reschedule") {
    await db.from("calls").update({ status: "retry", next_attempt_at: new Date(decision.at).toISOString() }).eq("id", call.id).eq("workspace_id", ws.id);
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
  if (aErr || !attempt) throw new ApiError(500, "Could not start the call. Try again.");
  await db
    .from("calls")
    .update({ status: "calling", attempt: attemptNo, next_attempt_at: null, failure_reason: null, manual: opts.manual || undefined })
    .eq("id", call.id)
    .eq("workspace_id", ws.id);

  if (e.CALL_MODE === "simulate") {
    const simId = `sim_${randomUUID()}`;
    await db.from("call_attempts").update({ sarvam_attempt_id: simId }).eq("id", attempt.id);
    const payload = simulatedPayload(simId, settings, lang, person.name, call.reminder_text);
    after(async () => {
      await new Promise((r) => setTimeout(r, 6000 + Math.random() * 4000));
      try {
        const claimed = await claimAttempt(simId, payload);
        if (claimed) await applyResult(claimed, payload);
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
    const claimed = await claimAttempt(failId, payload);
    if (claimed) await applyResult(claimed, payload);
    return { status: "failed", callId: call.id, message: `The call to ${person.name} could not be placed. Try again in a few minutes.` };
  }
}

/** "Call now" from the dashboard: dials today's call for a reminder, creating it if needed. */
export async function callReminderNow(ws: Workspace, reminderId: string): Promise<DialResult> {
  const db = supabaseAdmin();
  const { data: r, error } = await db
    .from("reminders")
    .select("id, kind, reminder_text, lang, person_id, people(id, name, phone, lang, consent)")
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
  await enforce(await gateFor(person, true, settings), person, ws, null);

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
      status: "retry",
      attempt: 0,
      manual: true,
    })
    .select("id")
    .single();
  if (cErr || !call) throw new ApiError(500, "Could not start the call. Try again.");
  return dialCall(ws, call.id, { manual: true });
}
