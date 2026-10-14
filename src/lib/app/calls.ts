import { RELIABILITY } from "./seed";
import { atTime, dayKey, fmtIn, fmtTs, inQuietHours, MINUTE, startOfDay } from "./time";
import type { AppState, CallRecord, DayResult, Outcome, Person, Reminder, ReminderKind } from "./types";

const RING_MS = MINUTE;
export const MANUAL_CALL_MS = 3500;

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

function occursOn(r: Reminder, dayStart: number) {
  if (r.repeat === "daily") return true;
  if (r.repeat === "weekdays") {
    const w = new Date(dayStart).getDay();
    return w >= 1 && w <= 5;
  }
  return r.onceDay === dayKey(dayStart);
}

export function canCall(p: Person | undefined): p is Person {
  return Boolean(p && p.consent === "granted" && !p.paused);
}

function simulate(r: Reminder, p: Person, dayStart: number, now: number, retryMin: number, manualAt?: number): CallRecord {
  const day = dayKey(dayStart);
  const t = atTime(dayStart, r.time);
  const base = { id: `${day}:${r.id}`, day, person: p, reminder: r, scheduledTs: t };

  if (manualAt !== undefined) {
    if (now < manualAt + MANUAL_CALL_MS) {
      return { ...base, status: "calling", result: -1, attempts: 1, durationSec: 0, note: "ringing" };
    }
    const answeredTs = manualAt + 3000;
    return { ...base, status: "confirmed", result: 2, outcome: "taken", attempts: 1, durationSec: 28, answeredTs, note: fmtTs(answeredTs) };
  }

  if (now < t) {
    return { ...base, status: "scheduled", result: -1, attempts: 0, durationSec: 0, note: fmtIn(t - now) };
  }

  const rand = mulberry(r.id * 7919 + Number(day.replaceAll("-", "")) * 31);
  const rel = (RELIABILITY[p.id] ?? 0.9) - (r.kind === "walk" ? 0.12 : r.kind === "visit" ? 0.05 : 0);
  const v = rand();
  const result: 2 | 1 | 0 = v < rel * 0.78 ? 2 : v < rel ? 1 : 0;
  const talk = 24 + Math.floor(rand() * 20);
  const ringing = { ...base, status: "calling" as const, result: -1 as const, durationSec: 0, note: "ringing" };

  if (result === 2) {
    if (now < t + RING_MS) return { ...ringing, attempts: 1 };
    const answeredTs = t + 40_000;
    return { ...base, status: "confirmed", result, outcome: "taken", attempts: 1, durationSec: talk, answeredTs, note: fmtTs(answeredTs) };
  }

  const firstOutcome: Outcome = result === 1 && rand() < 0.5 ? "later" : "no_answer";
  const firstTalk = firstOutcome === "later" ? 18 + Math.floor(rand() * 8) : 0;
  const retryAt = t + retryMin * MINUTE;
  if (now < t + RING_MS) return { ...ringing, attempts: 1 };
  if (now < retryAt) {
    return { ...base, status: "retry", result: -1, firstOutcome, attempts: 1, durationSec: firstTalk, note: fmtIn(retryAt - now) };
  }
  if (now < retryAt + RING_MS) return { ...ringing, firstOutcome, attempts: 2 };

  if (result === 1) {
    const answeredTs = retryAt + 40_000;
    return { ...base, status: "confirmed", result, outcome: "taken", firstOutcome, attempts: 2, durationSec: firstTalk + talk, answeredTs, note: fmtTs(answeredTs) };
  }
  const saidNo = rand() < 0.3;
  return {
    ...base,
    status: "missed",
    result: 0,
    outcome: saidNo ? "not_taken" : "no_answer",
    firstOutcome,
    attempts: 2,
    durationSec: firstTalk + (saidNo ? 20 : 0),
    answeredTs: saidNo ? retryAt + 30_000 : undefined,
    note: saidNo ? "said no" : "no answer",
  };
}

/** Every call for one day, in time order. */
export function callsOnDay(state: AppState, dayStart: number, now: number): CallRecord[] {
  const day = dayKey(dayStart);
  const out: CallRecord[] = [];
  for (const r of state.reminders) {
    if (!r.active || day < r.createdDay || !occursOn(r, dayStart)) continue;
    if (inQuietHours(r.time, state.settings)) continue;
    const p = state.family.find((f) => f.id === r.personId);
    if (!canCall(p)) continue;
    const manual = state.manual[`${day}:${r.id}`];
    out.push(simulate(r, p, dayStart, now, state.settings.retryMin, manual?.at));
  }
  return out.sort((a, b) => a.scheduledTs - b.scheduledTs);
}

export function todayCalls(state: AppState, now: number) {
  return callsOnDay(state, startOfDay(now), now);
}

/** Past and in-progress calls for the last `days` days, newest first. */
export function callHistory(state: AppState, now: number, days = 14) {
  const out: CallRecord[] = [];
  for (let d = 0; d <= days; d++) {
    for (const c of callsOnDay(state, startOfDay(now, -d), now)) if (c.status !== "scheduled") out.push(c);
  }
  return out.sort((a, b) => b.scheduledTs - a.scheduledTs);
}

export function lastFinishedCall(state: AppState, now: number) {
  return callHistory(state, now, 7).find((c) => c.status === "confirmed" || c.status === "missed");
}

export function usageMinutes(state: AppState, now: number) {
  const first = new Date(now).getDate() - 1;
  let sec = 0;
  for (let d = 0; d <= first; d++) for (const c of callsOnDay(state, startOfDay(now, -d), now)) sec += c.durationSec;
  return Math.round(sec / 60);
}

export const ADHERENCE_DAYS = 14;

export type AdherenceRow = { person: Person; cells: DayResult[]; pct: number | null };

function worst(results: DayResult[]): DayResult {
  if (!results.length) return -2;
  if (results.includes(-1)) return -1;
  return Math.min(...results) as DayResult;
}

function summarize(rows: DayResult[][]) {
  let first = 0, retried = 0, missed = 0, total = 0;
  for (const cells of rows) {
    for (const v of cells) {
      if (v < 0) continue;
      total++;
      if (v === 2) first++;
      else if (v === 1) retried++;
      else missed++;
    }
  }
  return { first, retried, missed, total };
}

/** Adherence for one reminder kind over the last 14 days, plus the 14 days before for comparison. */
export function adherence(state: AppState, kind: ReminderKind, now: number) {
  const people = state.family.filter(canCall);
  const span = ADHERENCE_DAYS * 2;
  const byDay: CallRecord[][] = [];
  for (let i = 0; i < span; i++) byDay.push(callsOnDay(state, startOfDay(now, i - span + 1), now));

  const cellsFor = (p: Person, from: number) =>
    byDay.slice(from, from + ADHERENCE_DAYS).map((calls) =>
      worst(calls.filter((c) => c.person.id === p.id && c.reminder.kind === kind).map((c) => c.result)),
    );

  const rows: AdherenceRow[] = people.map((p) => {
    const cells = cellsFor(p, ADHERENCE_DAYS);
    const s = summarize([cells]);
    return { person: p, cells, pct: s.total ? Math.round(((s.first + s.retried) / s.total) * 100) : null };
  });
  const prev = summarize(people.map((p) => cellsFor(p, 0)));
  const cur = summarize(rows.map((r) => r.cells));

  const perDay = Array.from({ length: ADHERENCE_DAYS }, (_, d) => {
    const vals = rows.map((r) => r.cells[d]).filter((v) => v >= 0);
    return vals.length ? vals.filter((v) => v > 0).length / vals.length : 1;
  });

  const pct = cur.total ? Math.round(((cur.first + cur.retried) / cur.total) * 100) : 0;
  const prevPct = prev.total ? ((prev.first + prev.retried) / prev.total) * 100 : pct;
  const dayStarts = Array.from({ length: ADHERENCE_DAYS }, (_, d) => startOfDay(now, d - ADHERENCE_DAYS + 1));

  return { rows, ...cur, pct, delta: pct - prevPct, perDay, dayStarts };
}
