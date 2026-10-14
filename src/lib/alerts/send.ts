import "server-only";

import { getSettings } from "../db/repo";
import { supabaseAdmin } from "../supabase-admin";
import { channelsFor } from "./channels";
import { processAlerts, type AlertCandidate } from "./trigger";

const LOOKBACK_MS = 6 * 60 * 60 * 1000;

type Row = {
  id: string;
  workspace_id: string;
  person_id: string;
  reminder_text: string;
  scheduled_at: string;
  status: string;
  attempt: number;
  response: string | null;
  failure_reason: string | null;
  unwell: boolean;
  alerted: boolean;
  people: { name: string } | null;
  workspaces: { name: string | null } | null;
};

/** Sends pending family alerts. Pass a callId to handle just that call (right after a webhook). */
export async function sendPendingAlerts(opts: { callId?: string } = {}) {
  const db = supabaseAdmin();
  const names = new Map<string, string>();

  return processAlerts({
    async listCandidates() {
      let q = db
        .from("calls")
        .select("id, workspace_id, person_id, reminder_text, scheduled_at, status, attempt, response, failure_reason, unwell, alerted, people(name), workspaces(name)")
        .eq("alerted", false)
        .or("status.eq.missed,unwell.eq.true,and(status.eq.confirmed,attempt.gt.3)");
      q = opts.callId ? q.eq("id", opts.callId) : q.gte("done_at", new Date(Date.now() - LOOKBACK_MS).toISOString());
      const { data, error } = await q.limit(50);
      if (error) throw new Error(`alert candidates failed: ${error.code}`);
      return (data as unknown as Row[]).map((r): AlertCandidate => {
        names.set(r.workspace_id, r.workspaces?.name ?? "your family");
        return {
          id: r.id,
          workspaceId: r.workspace_id,
          personId: r.person_id,
          personName: r.people?.name ?? "Your family member",
          reminderText: r.reminder_text,
          scheduledAt: new Date(r.scheduled_at).getTime(),
          status: r.status,
          attempt: r.attempt,
          response: r.response,
          failureReason: r.failure_reason,
          unwell: r.unwell,
          alerted: r.alerted,
        };
      });
    },
    async claim(callId) {
      const { data, error } = await db.from("calls").update({ alerted: true }).eq("id", callId).eq("alerted", false).select("id");
      if (error) throw new Error(`alert claim failed: ${error.code}`);
      return Boolean(data?.length);
    },
    async send(c, alert) {
      const settings = await getSettings(c.workspaceId);
      const ws = { id: c.workspaceId, name: names.get(c.workspaceId) ?? "your family", settings };
      const message = { kind: alert.kind, text: alert.message, callId: c.id, personId: c.personId };
      for (const channel of channelsFor(settings)) {
        try {
          await channel.send(ws, message);
        } catch (err) {
          console.error(`[alerts] ${channel.name} failed`, (err as Error).message);
        }
      }
    },
  });
}
