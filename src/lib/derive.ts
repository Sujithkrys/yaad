// Pure, typed logic shared by the API. No I/O and no server-only imports, so it
// can be unit tested. Every day boundary is IST (see time.ts).

import { addDaysIST, dayKeyIST, fmtIn, fmtTs, istDateAt, minutesOf, MINUTE, weekdayOfDayKey } from "./time";
import type { Adherence, AdherenceRow, Call, DayResult, Person, Reminder, ReminderKind, Settings, TodayItem } from "./types";

export function occursOn(r: Pick<Reminder, "repeat" | "onceDay">, dayKey: string) {
  if (r.repeat === "daily") return true;
  if (r.repeat === "weekdays") {
    const w = weekdayOfDayKey(dayKey);
    return w >= 1 && w <= 5;
  }
  return r.onceDay === dayKey;
}

/** True when HH:MM falls inside quiet hours. Handles windows that cross midnight. */
export function inQuiet(hhmm: string, s: Pick<Settings, "quietOn" | "quietFrom" | "quietTo">) {
  if (!s.quietOn) return false;
  const m = minutesOf(hhmm);
  const a = minutesOf(s.quietFrom);
  const b = minutesOf(s.quietTo);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

export function canCall(p: Person | undefined): p is Person {
  return Boolean(p && p.consent === "granted");
}

function callNote(c: Call, retryMin: number, now: number) {
  if (c.status === "confirmed") return fmtTs(c.doneAt ?? c.scheduledAt);
  if (c.status === "calling") return "ringing";
  if (c.status === "scheduled" || c.status === "retry") {
    const due = c.nextAttemptAt ?? (c.status === "scheduled" ? c.scheduledAt : (c.doneAt ?? c.scheduledAt) + retryMin * MINUTE);
    return due > now ? fmtIn(due - now) : "due now";
  }
  return c.response === "not_taken" ? "said no" : "no answer";
}

/** Today's call slots (IST): every reminder due today, joined with its call row if one exists. */
export function todayItems(
  reminders: Reminder[],
  people: Person[],
  calls: Call[],
  settings: Pick<Settings, "quietOn" | "quietFrom" | "quietTo" | "retryMin">,
  now: number,
): TodayItem[] {
  const today = dayKeyIST(now);
  const byId = new Map(people.map((p) => [p.id, p]));
  const items: TodayItem[] = [];

  for (const r of reminders) {
    const p = byId.get(r.personId);
    if (!r.active || !canCall(p) || !occursOn(r, today) || inQuiet(r.time, settings)) continue;
    const scheduledAt = istDateAt(today, r.time);
    // Latest attempt for this reminder today, manual or scheduled.
    const call = calls
      .filter((c) => c.reminderId === r.id && dayKeyIST(c.scheduledAt) === today)
      .sort((a, b) => b.attempt - a.attempt || (b.doneAt ?? 0) - (a.doneAt ?? 0))[0];

    items.push({
      key: `${r.id}:${today}`,
      reminderId: r.id,
      personId: p.id,
      personName: p.name,
      text: r.text,
      kind: r.kind,
      lang: r.lang ?? p.lang,
      scheduledAt,
      status: call ? call.status : "scheduled",
      note: call ? callNote(call, settings.retryMin, now) : scheduledAt > now ? fmtIn(scheduledAt - now) : "not placed",
      callId: call?.id ?? null,
    });
  }
  return items.sort((a, b) => a.scheduledAt - b.scheduledAt);
}

export function dayResult(c: Pick<Call, "status" | "attempt">): DayResult {
  if (c.status === "confirmed") return c.attempt > 1 ? 1 : 2;
  if (c.status === "missed") return 0;
  return -1;
}

function worst(results: DayResult[]): DayResult {
  if (!results.length) return -2;
  if (results.includes(-1)) return -1;
  return Math.min(...results) as DayResult;
}

function tally(rows: DayResult[][]) {
  let first = 0, retried = 0, missed = 0, total = 0;
  for (const cells of rows)
    for (const v of cells) {
      if (v < 0) continue;
      total++;
      if (v === 2) first++;
      else if (v === 1) retried++;
      else missed++;
    }
  return { first, retried, missed, total };
}

/**
 * Adherence for one reminder kind over the last `days` IST days (today included),
 * plus the change in percentage points against the `days` before that.
 */
export function adherence(calls: Call[], people: Person[], kind: ReminderKind, now: number, days = 14): Adherence {
  const span = Array.from({ length: days * 2 }, (_, i) => addDaysIST(now, i - days * 2 + 1));
  const recent = span.slice(days);
  const previous = span.slice(0, days);

  // Bucket results by person and day once.
  const buckets = new Map<string, DayResult[]>();
  for (const c of calls) {
    if (c.kind !== kind) continue;
    const key = `${c.personId}|${dayKeyIST(c.scheduledAt)}`;
    const list = buckets.get(key) ?? [];
    list.push(dayResult(c));
    buckets.set(key, list);
  }
  const cellsFor = (personId: string, dayKeys: string[]) => dayKeys.map((d) => worst(buckets.get(`${personId}|${d}`) ?? []));

  const granted = people.filter(canCall);
  const rows: AdherenceRow[] = granted.map((p) => {
    const cells = cellsFor(p.id, recent);
    const t = tally([cells]);
    return { personId: p.id, name: p.name, cells, pct: t.total ? Math.round(((t.first + t.retried) / t.total) * 100) : null };
  });

  const cur = tally(rows.map((r) => r.cells));
  const prev = tally(granted.map((p) => cellsFor(p.id, previous)));
  const pct = cur.total ? Math.round(((cur.first + cur.retried) / cur.total) * 100) : 0;
  const prevPct = prev.total ? ((prev.first + prev.retried) / prev.total) * 100 : pct;

  const perDay = recent.map((_, d) => {
    const vals = rows.map((r) => r.cells[d]).filter((v) => v >= 0);
    return vals.length ? vals.filter((v) => v > 0).length / vals.length : 1;
  });

  return { rows, days: recent, ...cur, pct, delta: Math.round((pct - prevPct) * 10) / 10, perDay };
}

export function lastFinishedCall(calls: Call[]) {
  return (
    calls
      .filter((c) => c.status === "confirmed" || c.status === "missed")
      .sort((a, b) => (b.doneAt ?? b.scheduledAt) - (a.doneAt ?? a.scheduledAt))[0] ?? null
  );
}

/** Talk minutes in the current IST calendar month. */
export function minutesUsed(calls: Call[], now: number) {
  const month = dayKeyIST(now).slice(0, 7);
  const sec = calls.filter((c) => dayKeyIST(c.scheduledAt).slice(0, 7) === month).reduce((n, c) => n + (c.durationSec ?? 0), 0);
  return Math.round(sec / 60);
}
