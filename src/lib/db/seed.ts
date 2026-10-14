import "server-only";

import { ApiError, dbError } from "@/lib/api";
import { transcriptFor } from "@/lib/conversation";
import { inQuiet, occursOn } from "@/lib/derive";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { addDaysIST, dayKeyIST, istDateAt, MINUTE } from "@/lib/time";
import type { Lang, ReminderKind, Repeat, Response, Settings } from "@/lib/types";
import { isWorkspaceEmpty } from "./repo";

type SeedPerson = { key: string; name: string; relation: string; phone: string; lang: Lang; consent: "granted" | "pending"; reliability: number };
type SeedReminder = { person: string; text: string; kind: ReminderKind; time: string; repeat: Repeat; once?: boolean; active?: boolean };

const PEOPLE: SeedPerson[] = [
  { key: "amma", name: "Amma", relation: "Mother", phone: "9876500011", lang: "te-IN", consent: "granted", reliability: 0.95 },
  { key: "nanna", name: "Nanna", relation: "Father", phone: "9876500012", lang: "te-IN", consent: "granted", reliability: 0.88 },
  { key: "dadi", name: "Dadi", relation: "Grandmother", phone: "9876500013", lang: "hi-IN", consent: "granted", reliability: 0.7 },
  { key: "paati", name: "Paati", relation: "Grandmother", phone: "9876500014", lang: "ta-IN", consent: "granted", reliability: 0.9 },
  { key: "mama", name: "Mama", relation: "Other", phone: "9876500015", lang: "kn-IN", consent: "pending", reliability: 0.9 },
];

const REMINDERS: SeedReminder[] = [
  { person: "dadi", text: "Morning tablet", kind: "tablet", time: "08:00", repeat: "daily" },
  { person: "amma", text: "BP tablet", kind: "tablet", time: "08:30", repeat: "daily" },
  { person: "nanna", text: "Sugar tablet", kind: "tablet", time: "13:30", repeat: "daily" },
  { person: "dadi", text: "Evening walk", kind: "walk", time: "18:00", repeat: "daily" },
  { person: "amma", text: "BP tablet", kind: "tablet", time: "19:00", repeat: "daily" },
  { person: "paati", text: "Thyroid tablet", kind: "tablet", time: "07:30", repeat: "daily" },
  { person: "nanna", text: "Morning walk", kind: "walk", time: "06:30", repeat: "weekdays" },
  { person: "paati", text: "Doctor visit", kind: "visit", time: "21:00", repeat: "once", once: true },
  { person: "amma", text: "Eye drops", kind: "tablet", time: "21:30", repeat: "daily", active: false },
];

const HISTORY_DAYS = 28;

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inserts the sample family, reminders and about four weeks of call history. */
export async function seedWorkspace(ws: string, settings: Settings, now = Date.now()) {
  if (!(await isWorkspaceEmpty(ws))) throw new ApiError(409, "Sample data can only be loaded into an empty workspace.");
  const db = supabaseAdmin();
  const today = dayKeyIST(now);

  const { data: people, error: pErr } = await db
    .from("people")
    .insert(PEOPLE.map(({ name, relation, phone, lang, consent }) => ({ workspace_id: ws, name, relation, phone, lang, consent })))
    .select("id, name");
  if (pErr || !people) throw dbError(pErr ?? {});
  const idOf = (key: string) => people.find((p) => p.name === PEOPLE.find((s) => s.key === key)!.name)!.id as string;

  const { data: reminders, error: rErr } = await db
    .from("reminders")
    .insert(
      REMINDERS.map((r) => ({
        workspace_id: ws,
        person_id: idOf(r.person),
        reminder_text: r.text,
        kind: r.kind,
        time_of_day: r.time,
        repeat_rule: r.repeat,
        once_day: r.once ? today : null,
        active: r.active ?? true,
      })),
    )
    .select("id, time_of_day");
  if (rErr || !reminders) throw dbError(rErr ?? {});

  const calls: Record<string, unknown>[] = [];
  REMINDERS.forEach((r, i) => {
    const person = PEOPLE.find((p) => p.key === r.person)!;
    if (person.consent !== "granted" || r.active === false || inQuiet(r.time, settings)) return;
    const reminderId = reminders[i].id as string;
    for (let d = -HISTORY_DAYS + 1; d <= 0; d++) {
      const day = addDaysIST(now, d);
      if (!occursOn({ repeat: r.repeat, onceDay: r.once ? today : null }, day)) continue;
      const t = istDateAt(day, r.time);
      if (t > now) continue;

      const rand = mulberry(i * 7919 + (d + 100) * 104729);
      const rel = person.reliability - (r.kind === "walk" ? 0.12 : r.kind === "visit" ? 0.05 : 0);
      const v = rand();
      const result = v < rel * 0.78 ? 2 : v < rel ? 1 : 0;
      const talk = 24 + Math.floor(rand() * 20);
      const retryAt = t + settings.retryMin * MINUTE;

      let status: "confirmed" | "missed" | "retry";
      let response: Response;
      let attempt = result === 2 ? 1 : 2;
      let doneAt: number;
      let duration = talk;
      if (result === 2) {
        status = "confirmed";
        response = "taken";
        doneAt = t + 40_000;
      } else if (now < retryAt + MINUTE) {
        // Still inside the retry window today.
        status = "retry";
        response = rand() < 0.5 ? "later" : "no_answer";
        attempt = 1;
        doneAt = t + 30_000;
        duration = response === "later" ? 18 : 0;
      } else if (result === 1) {
        status = "confirmed";
        response = "taken";
        doneAt = retryAt + 40_000;
      } else {
        status = "missed";
        response = rand() < 0.3 ? "not_taken" : "no_answer";
        doneAt = retryAt + 30_000;
        duration = response === "not_taken" ? 20 : 0;
      }

      calls.push({
        workspace_id: ws,
        reminder_id: reminderId,
        person_id: idOf(r.person),
        kind: r.kind,
        reminder_text: r.text,
        lang: person.lang,
        scheduled_at: new Date(t).toISOString(),
        status,
        attempt,
        response,
        duration_sec: duration,
        lines: transcriptFor(person.lang, person.name, r.text, response),
        alerted: status === "missed" && settings.alert,
        done_at: new Date(doneAt).toISOString(),
      });
    }
  });

  if (calls.length) {
    const { error } = await db.from("calls").insert(calls);
    if (error) throw dbError(error);
  }
  return { people: people.length, reminders: reminders.length, calls: calls.length };
}
