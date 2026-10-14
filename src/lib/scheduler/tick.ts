import "server-only";

import { sendPendingAlerts } from "../alerts/send";
import { applyResult, claimStaleAttempt } from "../calls/apply";
import { dialCall } from "../calls/dial";
import { toSettings, type SettingsRow } from "../db/mappers";
import { env } from "../env";
import { supabaseAdmin } from "../supabase-admin";
import { addDaysIST, dayKeyIST, istDateAt } from "../time";
import type { Lang, ReminderKind, Repeat } from "../types";
import { dispatchDue, type DueCall } from "./dispatch";
import { planSlots, type PlanPerson } from "./materialise";
import { recoverStale } from "./recover";

export type TickResult = { materialised: number; dialed: number; recovered: number; alerted: number };

async function materialise(now: number) {
  const db = supabaseAdmin();
  const [reminders, people, settings, recent] = await Promise.all([
    db.from("reminders").select("id, workspace_id, person_id, kind, reminder_text, time_of_day, repeat_rule, once_day, lang, created_at").eq("active", true),
    db.from("people").select("id, consent, lang, is_sample"),
    db.from("settings").select("*"),
    db
      .from("calls")
      .select("reminder_id, scheduled_at, status")
      .gte("scheduled_at", new Date(istDateAt(dayKeyIST(now), "00:00")).toISOString())
      .lt("scheduled_at", new Date(istDateAt(addDaysIST(now, 1), "00:00")).toISOString())
      .not("reminder_id", "is", null),
  ]);
  for (const r of [reminders, people, settings, recent]) if (r.error) throw new Error(`materialise read failed: ${r.error.code}`);

  const rows = planSlots({
    reminders: reminders.data!.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      personId: r.person_id,
      kind: r.kind as ReminderKind,
      text: r.reminder_text,
      time: r.time_of_day,
      repeat: r.repeat_rule as Repeat,
      onceDay: r.once_day,
      lang: r.lang as Lang | null,
      createdAt: new Date(r.created_at).getTime(),
    })),
    people: new Map(people.data!.map((p) => [p.id, { id: p.id, consent: p.consent, lang: p.lang, isSample: p.is_sample } as PlanPerson])),
    settings: new Map((settings.data as SettingsRow[]).map((s) => [s.workspace_id, toSettings(s)])),
    existing: recent.data!.map((c) => ({ reminderId: c.reminder_id, scheduledAt: new Date(c.scheduled_at).getTime(), status: c.status })),
    now,
    live: env().CALL_MODE === "live",
  });
  if (!rows.length) return 0;

  // ON CONFLICT (reminder_id, scheduled_at) DO NOTHING: overlapping ticks never duplicate.
  const { data, error } = await db.from("calls").upsert(rows, { onConflict: "reminder_id,scheduled_at", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(`materialise insert failed: ${error.code}`);
  return data?.length ?? 0;
}

async function dispatch(now: number) {
  const db = supabaseAdmin();
  const iso = new Date(now).toISOString();
  return dispatchDue({
    async listDue(limit) {
      const { data, error } = await db
        .from("calls")
        .select("id, status, workspace_id, workspaces(name)")
        .in("status", ["scheduled", "retry"])
        .or(`next_attempt_at.lte.${iso},and(next_attempt_at.is.null,scheduled_at.lte.${iso})`)
        .order("scheduled_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`dispatch read failed: ${error.code}`);
      return (data ?? []).map((c) => ({
        id: c.id,
        status: c.status as DueCall["status"],
        workspaceId: c.workspace_id,
        workspaceName: (c.workspaces as unknown as { name: string | null } | null)?.name ?? "",
      }));
    },
    async claim(c) {
      const { data, error } = await db.from("calls").update({ status: "calling" }).eq("id", c.id).eq("status", c.status).select("id");
      if (error) throw new Error(`dispatch claim failed: ${error.code}`);
      return Boolean(data?.length);
    },
    async dial(c) {
      await dialCall({ id: c.workspaceId, name: c.workspaceName }, c.id, { manual: false, claimed: c.status });
    },
  });
}

async function recover(now: number) {
  const db = supabaseAdmin();
  return recoverStale(
    {
      async listStale(before) {
        const { data, error } = await db
          .from("call_attempts")
          .select("id")
          .eq("status", "dialing")
          .lt("created_at", new Date(before).toISOString())
          .limit(20);
        if (error) throw new Error(`recover read failed: ${error.code}`);
        return (data ?? []).map((a) => a.id);
      },
      claim: claimStaleAttempt,
      apply: applyResult,
    },
    now,
  );
}

async function step<T>(name: string, fn: () => Promise<T>, fallback: T) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[scheduler] ${name} failed`, (err as Error).message);
    return fallback;
  }
}

/** One scheduler tick. Every step is idempotent, so retries and overlaps are safe. */
export async function runTick(now = Date.now()): Promise<TickResult> {
  const recovered = await step("recover", () => recover(now), 0);
  const materialised = await step("materialise", () => materialise(now), 0);
  const dialed = await step("dispatch", () => dispatch(now), 0);
  const alerted = await step("alerts", () => sendPendingAlerts(), 0);
  const result = { materialised, dialed, recovered, alerted };

  await supabaseAdmin()
    .from("app_state")
    .upsert({ key: "scheduler", value: { lastTickAt: new Date(now).toISOString(), result }, updated_at: new Date(now).toISOString() });
  return result;
}
