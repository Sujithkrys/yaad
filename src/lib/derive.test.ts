import { describe, expect, it } from "vitest";
import { adherence, inQuiet, occursOn, todayItems } from "./derive";
import { dayKeyIST, istDateAt } from "./time";
import type { Call, Person, Reminder } from "./types";

const person = (id: string, consent: Person["consent"] = "granted"): Person => ({
  id,
  name: id,
  relation: "Mother",
  phone: "9876500011",
  lang: "te-IN",
  consent,
  isSample: false,
  createdAt: "2026-01-01T00:00:00Z",
});

const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  id: "r1",
  personId: "amma",
  text: "BP tablet",
  kind: "tablet",
  time: "19:00",
  repeat: "daily",
  onceDay: null,
  active: true,
  lang: null,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

const call = (over: Partial<Call>): Call => ({
  id: Math.random().toString(36).slice(2),
  reminderId: "r1",
  personId: "amma",
  personName: "amma",
  kind: "tablet",
  text: "BP tablet",
  lang: "te-IN",
  scheduledAt: 0,
  status: "confirmed",
  attempt: 1,
  response: "taken",
  laterMin: null,
  durationSec: 30,
  lines: [],
  alerted: false,
  manual: false,
  doneAt: null,
  nextAttemptAt: null,
  failureReason: null,
  responseNote: null,
  unwell: false,
  ...over,
});

describe("occursOn", () => {
  it("weekdays: runs Monday to Friday only", () => {
    // 2026-10-12 is a Monday, 2026-10-17 a Saturday, 2026-10-18 a Sunday
    const r = { repeat: "weekdays" as const, onceDay: null };
    expect(occursOn(r, "2026-10-12")).toBe(true);
    expect(occursOn(r, "2026-10-16")).toBe(true);
    expect(occursOn(r, "2026-10-17")).toBe(false);
    expect(occursOn(r, "2026-10-18")).toBe(false);
  });

  it("once: runs only on its day", () => {
    const r = { repeat: "once" as const, onceDay: "2026-10-14" };
    expect(occursOn(r, "2026-10-14")).toBe(true);
    expect(occursOn(r, "2026-10-15")).toBe(false);
  });
});

describe("inQuiet", () => {
  const quiet = { quietOn: true, quietFrom: "22:00", quietTo: "06:00" };

  it("handles a window that crosses midnight", () => {
    expect(inQuiet("22:00", quiet)).toBe(true);
    expect(inQuiet("23:59", quiet)).toBe(true);
    expect(inQuiet("00:00", quiet)).toBe(true);
    expect(inQuiet("05:59", quiet)).toBe(true);
    expect(inQuiet("06:00", quiet)).toBe(false);
    expect(inQuiet("21:59", quiet)).toBe(false);
    expect(inQuiet("13:00", quiet)).toBe(false);
  });

  it("is off when disabled", () => {
    expect(inQuiet("23:00", { ...quiet, quietOn: false })).toBe(false);
  });
});

describe("IST day boundary", () => {
  it("puts 23:30 UTC on the next IST day", () => {
    const ts = Date.UTC(2026, 9, 14, 23, 30); // 15 Oct 05:00 IST
    expect(dayKeyIST(ts)).toBe("2026-10-15");
    expect(dayKeyIST(Date.UTC(2026, 9, 14, 18, 29))).toBe("2026-10-14"); // 23:59 IST
    expect(dayKeyIST(Date.UTC(2026, 9, 14, 18, 30))).toBe("2026-10-15"); // 00:00 IST
  });

  it("istDateAt converts IST wall time to UTC", () => {
    expect(istDateAt("2026-10-14", "19:00")).toBe(Date.UTC(2026, 9, 14, 13, 30));
  });
});

describe("adherence", () => {
  const now = istDateAt("2026-10-14", "20:00");
  const at = (day: string) => istDateAt(day, "19:00");

  it("counts first ring, retry and missed per person", () => {
    const calls = [
      call({ scheduledAt: at("2026-10-14"), status: "confirmed", attempt: 1 }),
      call({ scheduledAt: at("2026-10-13"), status: "confirmed", attempt: 2 }),
      call({ scheduledAt: at("2026-10-12"), status: "missed", attempt: 2, response: "no_answer" }),
      call({ scheduledAt: at("2026-10-11"), status: "retry", attempt: 1 }),
      call({ scheduledAt: at("2026-10-13"), kind: "walk" }),
    ];
    const a = adherence(calls, [person("amma"), person("mama", "pending")], "tablet", now);
    expect(a.rows).toHaveLength(1); // pending consent is excluded
    expect(a.first).toBe(1);
    expect(a.retried).toBe(1);
    expect(a.missed).toBe(1);
    expect(a.total).toBe(3);
    expect(a.pct).toBe(67);
    expect(a.days).toHaveLength(14);
    expect(a.days[13]).toBe("2026-10-14");
    expect(a.rows[0].cells.slice(-4)).toEqual([-1, 0, 1, 2]);
  });

  it("buckets calls by IST day, not UTC day", () => {
    // 15 Oct 00:30 IST is 14 Oct 19:00 UTC
    const late = call({ scheduledAt: Date.UTC(2026, 9, 14, 19, 0) });
    const a = adherence([late], [person("amma")], "tablet", istDateAt("2026-10-15", "09:00"));
    expect(a.rows[0].cells[13]).toBe(2);
    expect(a.rows[0].cells[12]).toBe(-2);
  });
});

describe("todayItems", () => {
  const settings = { quietOn: true, quietFrom: "22:00", quietTo: "06:00", retryMin: 10 as const };
  const now = istDateAt("2026-10-14", "12:00");

  it("joins reminders with today's call and skips quiet hours and pending consent", () => {
    const items = todayItems(
      [
        reminder({ id: "a", time: "08:00" }),
        reminder({ id: "b", time: "19:00" }),
        reminder({ id: "c", time: "23:00" }),
        reminder({ id: "d", personId: "mama", time: "09:00" }),
      ],
      [person("amma"), person("mama", "pending")],
      [call({ reminderId: "a", scheduledAt: istDateAt("2026-10-14", "08:00"), doneAt: istDateAt("2026-10-14", "08:01") })],
      settings,
      now,
    );
    expect(items.map((i) => [i.reminderId, i.status])).toEqual([
      ["a", "confirmed"],
      ["b", "scheduled"],
    ]);
    expect(items[0].note).toBe("8:01 AM");
    expect(items[1].note).toBe("in 7h 0m");
  });
});
