import { describe, expect, it, vi } from "vitest";
import { alertFor, processAlerts, type AlertCandidate } from "../alerts/trigger";
import { istDateAt } from "../time";
import { authorizeTick } from "./auth";
import { dispatchDue, type DueCall } from "./dispatch";
import { planSlots, type PlanPerson, type PlanReminder } from "./materialise";
import { recoverStale, STALE_MS } from "./recover";

const QUIET = { quietOn: true, quietFrom: "22:00", quietTo: "06:00" };

const reminder = (over: Partial<PlanReminder> = {}): PlanReminder => ({
  id: "r1",
  workspaceId: "w1",
  personId: "p1",
  kind: "tablet",
  text: "BP tablet",
  time: "19:00",
  repeat: "daily",
  onceDay: null,
  lang: null,
  createdAt: Date.UTC(2026, 0, 1),
  ...over,
});

function plan(reminders: PlanReminder[], now: number, opts: { existing?: { reminderId: string; scheduledAt: number; status: string }[]; person?: Partial<PlanPerson>; live?: boolean } = {}) {
  return planSlots({
    reminders,
    people: new Map([["p1", { id: "p1", consent: "granted", lang: "te-IN", isSample: false, ...opts.person }]]),
    settings: new Map([["w1", QUIET]]),
    existing: opts.existing ?? [],
    now,
    live: opts.live ?? true,
  });
}

describe("materialise", () => {
  it("turns a 19:00 IST reminder into a 13:30 UTC scheduled call", () => {
    const rows = plan([reminder()], istDateAt("2026-10-14", "18:59"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ scheduled_at: "2026-10-14T13:30:00.000Z", status: "scheduled", attempt: 0, manual: false, lang: "te-IN" });
  });

  it("only picks slots from 60 minutes ago to 2 minutes ahead", () => {
    expect(plan([reminder()], istDateAt("2026-10-14", "18:57"))).toHaveLength(0);
    expect(plan([reminder()], istDateAt("2026-10-14", "19:59"))).toHaveLength(1);
    expect(plan([reminder()], istDateAt("2026-10-14", "20:01"))).toHaveLength(0);
  });

  it("is idempotent: an existing call for the slot means nothing new", () => {
    const now = istDateAt("2026-10-14", "19:01");
    const first = plan([reminder()], now);
    const again = plan([reminder()], now, {
      existing: [{ reminderId: "r1", scheduledAt: new Date(first[0].scheduled_at).getTime(), status: "scheduled" }],
    });
    expect(again).toHaveLength(0);
    // A "Call now" earlier around the slot also counts.
    expect(plan([reminder()], now, { existing: [{ reminderId: "r1", scheduledAt: istDateAt("2026-10-14", "18:30"), status: "retry" }] })).toHaveLength(0);
  });

  it("applies the occurs-today rules", () => {
    const mon = istDateAt("2026-10-12", "19:00");
    const sat = istDateAt("2026-10-17", "19:00");
    expect(plan([reminder({ repeat: "weekdays" })], mon)).toHaveLength(1);
    expect(plan([reminder({ repeat: "weekdays" })], sat)).toHaveLength(0);
    expect(plan([reminder({ repeat: "once", onceDay: "2026-10-12" })], mon)).toHaveLength(1);
    expect(plan([reminder({ repeat: "once", onceDay: "2026-10-13" })], mon)).toHaveLength(0);
  });

  it("skips quiet hours, missing consent, sample people when live, and reminders added after their time", () => {
    expect(plan([reminder({ time: "23:00" })], istDateAt("2026-10-14", "23:00"))).toHaveLength(0);
    expect(plan([reminder()], istDateAt("2026-10-14", "19:00"), { person: { consent: "pending" } })).toHaveLength(0);
    expect(plan([reminder()], istDateAt("2026-10-14", "19:00"), { person: { isSample: true } })).toHaveLength(0);
    expect(plan([reminder()], istDateAt("2026-10-14", "19:00"), { person: { isSample: true }, live: false })).toHaveLength(1);
    expect(plan([reminder({ createdAt: istDateAt("2026-10-14", "19:10") })], istDateAt("2026-10-14", "19:20"))).toHaveLength(0);
  });
});

describe("dispatch", () => {
  it("claims each row only once when two ticks run at the same time", async () => {
    // In-memory rows with an atomic compare-and-set, like UPDATE ... WHERE status=$2 RETURNING.
    const rows = new Map<string, string>([
      ["a", "scheduled"],
      ["b", "retry"],
      ["c", "scheduled"],
    ]);
    const dialed: string[] = [];
    const deps = () => ({
      listDue: async () => [...rows].filter(([, s]) => s === "scheduled" || s === "retry").map(([id, s]) => ({ id, status: s, workspaceId: "w", workspaceName: "W" }) as DueCall),
      claim: async (c: DueCall) => {
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        if (rows.get(c.id) !== c.status) return false;
        rows.set(c.id, "calling");
        return true;
      },
      dial: async (c: DueCall) => {
        dialed.push(c.id);
      },
    });
    const [x, y] = await Promise.all([dispatchDue(deps()), dispatchDue(deps())]);
    expect(x + y).toBe(3);
    expect(dialed.sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps going when one dial fails", async () => {
    const dial = vi.fn(async (c: DueCall) => {
      if (c.id === "a") throw new Error("boom");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const n = await dispatchDue({
      listDue: async () => ["a", "b"].map((id) => ({ id, status: "scheduled", workspaceId: "w", workspaceName: "W" }) as DueCall),
      claim: async () => true,
      dial,
    });
    spy.mockRestore();
    expect(dial).toHaveBeenCalledTimes(2);
    expect(n).toBe(1);
  });
});

describe("recover", () => {
  it("fails attempts stuck in dialing for 10 minutes, once each", async () => {
    const now = Date.UTC(2026, 9, 14, 13, 30);
    const states = new Map([["att1", "dialing"]]);
    const apply = vi.fn(async () => {});
    const deps = {
      listStale: vi.fn(async (before: number) => {
        expect(before).toBe(now - STALE_MS);
        return [...states].filter(([, s]) => s === "dialing").map(([id]) => id);
      }),
      claim: vi.fn(async (id: string) => {
        if (states.get(id) !== "dialing") return null;
        states.set(id, "failed");
        return { callId: "c1", workspaceId: "w1", attemptNo: 1 };
      }),
      apply,
    };
    expect(await recoverStale(deps, now)).toBe(1);
    expect(apply).toHaveBeenCalledWith({ callId: "c1", workspaceId: "w1", attemptNo: 1 }, expect.objectContaining({ status: "failed", failure_reason: "webhook_timeout" }));
    expect(await recoverStale(deps, now)).toBe(0);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});

describe("alerts", () => {
  const call = (over: Partial<AlertCandidate> = {}): AlertCandidate => ({
    id: "c1",
    workspaceId: "w1",
    personId: "p1",
    personName: "Amma",
    reminderText: "BP tablet",
    scheduledAt: istDateAt("2026-10-14", "19:00"),
    status: "missed",
    attempt: 3,
    response: "no_answer",
    failureReason: "no_answer",
    unwell: false,
    alerted: false,
    ...over,
  });

  it("writes plain, calm messages", () => {
    expect(alertFor(call())?.message).toBe("Amma did not pick up the 7:00 PM BP tablet reminder (3 attempts).");
    expect(alertFor(call({ unwell: true, status: "confirmed" }))).toEqual({
      kind: "unwell",
      message: "Amma said they are not feeling well during the 7:00 PM call. Please check in.",
    });
    expect(alertFor(call({ status: "confirmed", attempt: 4, response: "taken" }))?.kind).toBe("info");
    expect(alertFor(call({ status: "confirmed", attempt: 2, response: "taken" }))).toBeNull();
  });

  it("does not alert when no call was really made", () => {
    for (const failureReason of ["daily_limit", "no_consent", "sample_person", "not_allowlisted", "bad_phone"]) {
      expect(alertFor(call({ failureReason }))).toBeNull();
    }
  });

  it("fires exactly once, even when two runs overlap", async () => {
    let alerted = false;
    const send = vi.fn(async () => {});
    const deps = {
      listCandidates: async () => [call({ alerted })],
      claim: async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        if (alerted) return false;
        alerted = true;
        return true;
      },
      send,
    };
    await Promise.all([processAlerts(deps), processAlerts(deps)]);
    await processAlerts(deps);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("tick auth", () => {
  const secret = "d".repeat(32);
  const base = { authorization: null, devSecret: secret, signature: null, verifySignature: async () => false };

  it("rejects a bad or missing QStash signature (the route answers 401)", async () => {
    expect(await authorizeTick({ ...base, nodeEnv: "production" })).toBe(false);
    expect(await authorizeTick({ ...base, nodeEnv: "production", signature: "bad" })).toBe(false);
    expect(await authorizeTick({ ...base, nodeEnv: "production", signature: "x", verifySignature: async () => Promise.reject(new Error("invalid")) })).toBe(false);
    expect(await authorizeTick({ ...base, nodeEnv: "production", signature: "good", verifySignature: async () => true })).toBe(true);
  });

  it("accepts the dev secret only outside production", async () => {
    const bearer = `Bearer ${secret}`;
    expect(await authorizeTick({ ...base, nodeEnv: "development", authorization: bearer })).toBe(true);
    expect(await authorizeTick({ ...base, nodeEnv: "production", authorization: bearer })).toBe(false);
    expect(await authorizeTick({ ...base, nodeEnv: "development", authorization: "Bearer wrong" })).toBe(false);
  });
});
