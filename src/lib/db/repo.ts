import "server-only";

import { ApiError, dbError, notFound } from "@/lib/api";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { addDaysIST, istDateAt } from "@/lib/time";
import type { Call, Person, Reminder, Settings } from "@/lib/types";
import { settingsPatch, toCall, toPerson, toReminder, toSettings, type CallRow, type PersonRow, type ReminderRow, type SettingsRow } from "./mappers";

// Every query is scoped by workspace_id, including lookups by id, so a
// request can never touch another workspace's rows.

const db = () => supabaseAdmin();
const PHONE_TAKEN = "Someone in your family already has this mobile number.";

/* ---------- people ---------- */

export async function listPeople(ws: string): Promise<Person[]> {
  const { data, error } = await db().from("people").select("*").eq("workspace_id", ws).order("created_at");
  if (error) throw dbError(error);
  return (data as PersonRow[]).map(toPerson);
}

export async function createPerson(ws: string, input: Pick<Person, "name" | "relation" | "phone" | "lang">, consent: Person["consent"] = "pending") {
  const max = env().MAX_PEOPLE_PER_WORKSPACE;
  const { count, error: countError } = await db().from("people").select("id", { count: "exact", head: true }).eq("workspace_id", ws);
  if (countError) throw dbError(countError);
  if ((count ?? 0) >= max) throw new ApiError(409, `You can add up to ${max} family members in this demo.`);
  const { data, error } = await db()
    .from("people")
    .insert({ workspace_id: ws, ...input, consent })
    .select("*")
    .single();
  if (error) throw dbError(error, PHONE_TAKEN);
  return toPerson(data as PersonRow);
}

export async function updatePerson(ws: string, id: string, patch: Partial<Pick<Person, "name" | "relation" | "phone" | "lang" | "consent">>) {
  const { data, error } = await db().from("people").update(patch).eq("workspace_id", ws).eq("id", id).select("*").maybeSingle();
  if (error) throw dbError(error, PHONE_TAKEN);
  if (!data) throw notFound("That person");
  return toPerson(data as PersonRow);
}

export async function deletePerson(ws: string, id: string) {
  const { data, error } = await db().from("people").delete().eq("workspace_id", ws).eq("id", id).select("id");
  if (error) throw dbError(error);
  if (!data?.length) throw notFound("That person");
}

/* ---------- reminders ---------- */

export async function listReminders(ws: string): Promise<Reminder[]> {
  const { data, error } = await db().from("reminders").select("*").eq("workspace_id", ws).order("time_of_day");
  if (error) throw dbError(error);
  return (data as ReminderRow[]).map(toReminder);
}

type ReminderFields = Partial<Omit<Reminder, "id" | "createdAt">>;

function reminderRow(r: ReminderFields) {
  const out: Record<string, unknown> = {};
  if (r.personId !== undefined) out.person_id = r.personId;
  if (r.text !== undefined) out.reminder_text = r.text;
  if (r.kind !== undefined) out.kind = r.kind;
  if (r.time !== undefined) out.time_of_day = r.time;
  if (r.repeat !== undefined) out.repeat_rule = r.repeat;
  if (r.onceDay !== undefined) out.once_day = r.onceDay;
  if (r.active !== undefined) out.active = r.active;
  if (r.lang !== undefined) out.lang = r.lang;
  return out;
}

async function assertPerson(ws: string, personId: string) {
  const { data, error } = await db().from("people").select("id").eq("workspace_id", ws).eq("id", personId).maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw notFound("That person");
}

export async function createReminder(ws: string, input: ReminderFields & { personId: string }) {
  await assertPerson(ws, input.personId);
  const { data, error } = await db()
    .from("reminders")
    .insert({ workspace_id: ws, ...reminderRow(input) })
    .select("*")
    .single();
  if (error) throw dbError(error);
  return toReminder(data as ReminderRow);
}

export async function updateReminder(ws: string, id: string, patch: ReminderFields) {
  if (patch.personId) await assertPerson(ws, patch.personId);
  const { data, error } = await db().from("reminders").update(reminderRow(patch)).eq("workspace_id", ws).eq("id", id).select("*").maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw notFound("That reminder");
  return toReminder(data as ReminderRow);
}

export async function deleteReminder(ws: string, id: string) {
  const { data, error } = await db().from("reminders").delete().eq("workspace_id", ws).eq("id", id).select("id");
  if (error) throw dbError(error);
  if (!data?.length) throw notFound("That reminder");
}

/* ---------- calls ---------- */

const CALL_COLUMNS = "*, people(name)";

export async function listCalls(ws: string, opts: { person?: string; status?: Call["status"]; sinceDays?: number; limit?: number }) {
  let q = db().from("calls").select(CALL_COLUMNS).eq("workspace_id", ws);
  if (opts.person) q = q.eq("person_id", opts.person);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.sinceDays !== undefined) q = q.gte("scheduled_at", new Date(istDateAt(addDaysIST(Date.now(), -opts.sinceDays), "00:00")).toISOString());
  const { data, error } = await q.order("scheduled_at", { ascending: false }).limit(opts.limit ?? 200);
  if (error) throw dbError(error);
  return (data as CallRow[]).map(toCall);
}

/* ---------- settings ---------- */

export async function getSettings(ws: string): Promise<Settings> {
  const { data, error } = await db().from("settings").select("*").eq("workspace_id", ws).maybeSingle();
  if (error) throw dbError(error);
  if (data) return toSettings(data as SettingsRow);
  // Settings row is created with the workspace; recreate it if it went missing.
  const created = await db().from("settings").insert({ workspace_id: ws }).select("*").single();
  if (created.error) throw dbError(created.error);
  return toSettings(created.data as SettingsRow);
}

export async function putSettings(ws: string, patch: Partial<Settings>) {
  const row = settingsPatch(patch);
  if (!Object.keys(row).length) return getSettings(ws);
  const { data, error } = await db().from("settings").update(row).eq("workspace_id", ws).select("*").maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, "Settings were not found.");
  return toSettings(data as SettingsRow);
}

/* ---------- workspace data ---------- */

export async function isWorkspaceEmpty(ws: string) {
  const { count, error } = await db().from("people").select("id", { count: "exact", head: true }).eq("workspace_id", ws);
  if (error) throw dbError(error);
  return !count;
}

/** Deletes people, reminders and calls. Settings are kept. */
export async function resetWorkspace(ws: string) {
  for (const table of ["calls", "reminders", "people"] as const) {
    const { error } = await db().from(table).delete().eq("workspace_id", ws);
    if (error) throw dbError(error);
  }
}
