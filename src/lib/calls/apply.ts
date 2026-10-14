import "server-only";

import { getSettings } from "../db/repo";
import { supabaseAdmin } from "../supabase-admin";
import type { TranscriptLine } from "../types";
import { resolveOutcome, type AttemptResult } from "./resolve";
import { attemptStatusOf, type WebhookPayload } from "./webhook";

// Applies a finished attempt (from the webhook or the simulator) to the call.

type Claimed = { callId: string; workspaceId: string; attemptNo: number };

/**
 * Marks the attempt finished, but only if it is still dialing. A second
 * delivery of the same webhook finds nothing to update and is ignored.
 */
export async function claimAttempt(attemptId: string, payload: WebhookPayload): Promise<Claimed | null> {
  const fv = payload.final_agent_variables ?? {};
  const { data, error } = await supabaseAdmin()
    .from("call_attempts")
    .update({
      status: attemptStatusOf(payload.status),
      response: fv.response != null ? String(fv.response).slice(0, 200) : null,
      duration_sec: payload.duration ?? null,
      interaction_id: payload.interaction_id ?? null,
      failure_reason: payload.failure_reason ?? null,
      payload,
      finished_at: new Date().toISOString(),
    })
    .eq("sarvam_attempt_id", attemptId)
    .eq("status", "dialing")
    .select("call_id, workspace_id, attempt_no");
  if (error) throw new Error(`claim failed: ${error.code}`);
  const row = data?.[0];
  return row ? { callId: row.call_id, workspaceId: row.workspace_id, attemptNo: row.attempt_no } : null;
}

function transcriptLines(payload: WebhookPayload): TranscriptLine[] {
  let sec = 2;
  return (payload.interaction_transcript ?? [])
    .filter((t) => (t.en_text ?? t.text ?? "").trim())
    .map((t) => {
      const role = /agent|assistant|bot|ai/i.test(t.role ?? "") ? "agent" : "user";
      const english = (t.en_text ?? t.text ?? "").trim();
      const at = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
      sec += 8;
      return { role, native: (t.text ?? english).trim(), english, at } as TranscriptLine;
    });
}

export async function raiseAlert(input: { workspaceId: string; callId: string; personId: string; kind: "missed" | "unwell"; message: string; channel: string | null }) {
  // Stub: records the alert. Delivery by WhatsApp or SMS comes with QStash.
  const { error } = await supabaseAdmin().from("alerts").insert({
    workspace_id: input.workspaceId,
    call_id: input.callId,
    person_id: input.personId,
    kind: input.kind,
    message: input.message,
    channel: input.channel,
  });
  if (error) console.error("[alerts] insert failed", error.code);
}

export async function applyResult(claimed: Claimed, payload: WebhookPayload) {
  const db = supabaseAdmin();
  const { data: call, error } = await db
    .from("calls")
    .select("id, person_id, reminder_text, duration_sec, alerted, people(name)")
    .eq("id", claimed.callId)
    .eq("workspace_id", claimed.workspaceId)
    .maybeSingle();
  if (error) throw new Error(`call lookup failed: ${error.code}`);
  if (!call) return;

  const settings = await getSettings(claimed.workspaceId);
  const fv = payload.final_agent_variables ?? {};
  const result: AttemptResult = {
    status: attemptStatusOf(payload.status),
    response: fv.response != null ? String(fv.response) : null,
    laterMinutes: (fv.later_minutes as number | string | null | undefined) ?? null,
    unwell: (fv.unwell as boolean | string | null | undefined) ?? null,
    failureReason: payload.failure_reason ?? null,
  };
  const now = Date.now();
  const outcome = resolveOutcome(result, {
    attemptNo: claimed.attemptNo,
    maxAttempts: settings.maxAttempts,
    retryMin: settings.retryMin,
    now,
  });

  const lines = transcriptLines(payload);
  const summary = fv.call_summary != null ? String(fv.call_summary).slice(0, 1000) : null;
  const update: Record<string, unknown> = {
    status: outcome.callStatus,
    response: outcome.response,
    later_min: outcome.laterMin,
    next_attempt_at: outcome.nextAttemptAt ? new Date(outcome.nextAttemptAt).toISOString() : null,
    failure_reason: outcome.failureReason,
    duration_sec: Math.round((call.duration_sec ?? 0) + (payload.duration ?? 0)),
  };
  if (lines.length) update.lines = lines;
  if (summary) update.response_note = summary;
  if (outcome.done) update.done_at = new Date(now).toISOString();

  const sendAlert = outcome.alert === "unwell" || (outcome.alert === "missed" && settings.alert);
  if (sendAlert) update.alerted = true;

  const { error: upErr } = await db.from("calls").update(update).eq("id", call.id).eq("workspace_id", claimed.workspaceId);
  if (upErr) throw new Error(`call update failed: ${upErr.code}`);

  if (sendAlert && outcome.alert) {
    const name = (call.people as { name?: string } | null)?.name ?? "Your family member";
    await raiseAlert({
      workspaceId: claimed.workspaceId,
      callId: call.id,
      personId: call.person_id,
      kind: outcome.alert,
      channel: settings.alertChannel,
      message:
        outcome.alert === "unwell"
          ? `${name} said they are not feeling well during the ${call.reminder_text} call. Please check on them.`
          : `${name} did not confirm ${call.reminder_text} after ${claimed.attemptNo} calls.`,
    });
  }
}
