// End-to-end checks against a running dev server in CALL_MODE=simulate.
// Usage: pnpm e2e [baseUrl]   (default http://localhost:3002)
// Creates throwaway "QA e2e" workspaces, scopes every scheduler tick to them,
// and deletes them at the end. Never places a real call. Never prints secrets.

import { randomUUID } from "node:crypto";

const BASE = (process.argv[2] ?? process.env.E2E_URL ?? "http://localhost:3002").replace(/\/$/, "");
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const DEV = process.env.CRON_DEV_SECRET;
const HOOK = process.env.SARVAM_WEBHOOK_SECRET;
const TAG = `QA e2e ${Date.now().toString(36)}`;
const PASS = "qa-password-1";
for (const [k, v] of Object.entries({ SUPABASE_URL: SB, SUPABASE_SECRET_KEY: KEY, CRON_DEV_SECRET: DEV, SARVAM_WEBHOOK_SECRET: HOOK })) {
  if (!v) {
    console.error(`${k} is not set.`);
    process.exit(1);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- HTTP clients ---------- */

class Visitor {
  cookie = "";
  async req(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) {
      const m = /yaad_session=([^;]*)/.exec(set);
      if (m) this.cookie = m[1] ? `yaad_session=${m[1]}` : "";
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text, setCookie: set, type: res.headers.get("content-type") ?? "" };
  }
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
const db = {
  async get(table, query) {
    const r = await fetch(`${SB}/rest/v1/${table}?${query}`, { headers: H });
    if (!r.ok) throw new Error(`db get ${table} ${r.status}`);
    return r.json();
  },
  async insert(table, rows) {
    const r = await fetch(`${SB}/rest/v1/${table}`, { method: "POST", headers: H, body: JSON.stringify(rows) });
    if (!r.ok) throw new Error(`db insert ${table} ${r.status} ${(await r.text()).slice(0, 160)}`);
    return r.json();
  },
  async update(table, query, patch) {
    const r = await fetch(`${SB}/rest/v1/${table}?${query}`, { method: "PATCH", headers: H, body: JSON.stringify(patch) });
    if (!r.ok) throw new Error(`db update ${table} ${r.status}`);
    return r.json();
  },
  async del(table, query) {
    const r = await fetch(`${SB}/rest/v1/${table}?${query}`, { method: "DELETE", headers: H });
    if (!r.ok) throw new Error(`db delete ${table} ${r.status}`);
  },
};

/* ---------- helpers ---------- */

const ist = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function istParts(ts) {
  const p = Object.fromEntries(ist.formatToParts(ts).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: p.hour, mm: p.minute };
}
const hhmm = (ts) => `${istParts(ts).hh}:${istParts(ts).mm}`;
/** UTC epoch of HH:MM on today's IST date. */
function slotUtc(ts, time) {
  const { y, m, d } = istParts(ts);
  const [h, mi] = time.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h, mi) - 330 * 60_000;
}
const iso = (ms) => new Date(ms).toISOString();
let phoneSeq = Math.floor(Math.random() * 9_000_000);
const phone = () => `91${String(10_000_000 + ((phoneSeq += 7) % 89_999_999)).padStart(8, "0")}`; // 10 digits starting 9

async function workspace(label) {
  const v = new Visitor();
  const r = await v.req("POST", "/api/workspace", { name: `${TAG} ${label}`, password: PASS });
  if (r.status !== 200) throw new Error(`workspace ${label}: ${r.status} ${r.text.slice(0, 120)}`);
  v.id = r.json.workspace.id;
  return v;
}
async function person(v, over = {}, consent = true) {
  const r = await v.req("POST", "/api/family", { name: over.name ?? "Amma", relation: "Mother", phone: over.phone ?? phone(), lang: over.lang ?? "te-IN" });
  if (r.status !== 200) throw new Error(`person: ${r.status} ${r.text.slice(0, 160)}`);
  if (consent) await v.req("POST", `/api/family/${r.json.id}/consent`, { status: "granted" });
  return r.json;
}
async function reminder(v, personId, time, over = {}) {
  const r = await v.req("POST", "/api/reminders", { personId, text: over.text ?? "BP tablet", time, repeat: "daily", kind: "tablet", ...over });
  if (r.status !== 200) throw new Error(`reminder: ${r.status} ${r.text.slice(0, 160)}`);
  return r.json;
}
async function settings(v, patch) {
  const r = await v.req("PUT", "/api/settings", patch);
  if (r.status !== 200) throw new Error(`settings: ${r.status} ${r.text.slice(0, 160)}`);
}
async function tick(v, auth = `Bearer ${DEV}`) {
  const r = await fetch(`${BASE}/api/cron/tick${v ? `?workspace=${v.id}` : ""}`, { method: "POST", headers: auth ? { Authorization: auth } : {} });
  return { status: r.status, json: await r.json().catch(() => null) };
}
const call = async (id) => (await db.get("calls", `id=eq.${id}&select=*`))[0];
async function waitFor(fn, ms = 25_000, every = 1500) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(every);
  }
}
/** A call that is ringing right now, with a 'dialing' attempt we control (as if Sarvam had accepted it). */
async function ringing(v, p, { attemptNo = 1, ageMs = 5 * 60_000, reminderId = null } = {}) {
  const [c] = await db.insert("calls", [
    {
      workspace_id: v.id,
      reminder_id: reminderId,
      person_id: p.id,
      kind: "tablet",
      reminder_text: "BP tablet",
      lang: p.lang,
      scheduled_at: iso(Date.now() - ageMs - Math.floor(Math.random() * 1000)),
      status: "calling",
      attempt: attemptNo,
      manual: true,
    },
  ]);
  const attemptId = `qa_${randomUUID()}`;
  await db.insert("call_attempts", [{ workspace_id: v.id, call_id: c.id, attempt_no: attemptNo, status: "dialing", sarvam_attempt_id: attemptId, created_at: iso(Date.now() - ageMs) }]);
  return { callId: c.id, attemptId };
}
async function nextAttempt(v, callId, attemptNo, ageMs = 5 * 60_000) {
  const attemptId = `qa_${randomUUID()}`;
  await db.update("calls", `id=eq.${callId}`, { status: "calling", attempt: attemptNo });
  await db.insert("call_attempts", [{ workspace_id: v.id, call_id: callId, attempt_no: attemptNo, status: "dialing", sarvam_attempt_id: attemptId, created_at: iso(Date.now() - ageMs) }]);
  return attemptId;
}
const hook = (body, token = HOOK) =>
  fetch(`${BASE}/api/webhooks/sarvam${token === null ? "" : `?token=${encodeURIComponent(token)}`}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

/* ---------- runner ---------- */

const results = [];
async function test(area, name, fn) {
  try {
    const note = await fn();
    results.push({ area, name, ok: true, note: note ?? "" });
    console.log(`PASS  ${area}  ${name}${note ? `  (${note})` : ""}`);
  } catch (err) {
    results.push({ area, name, ok: false, note: err.message });
    console.log(`FAIL  ${area}  ${name}  -> ${err.message}`);
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function cleanup() {
  await db.del("workspaces", `name=ilike.${encodeURIComponent("QA e2e%")}`);
}

/* ---------- tests ---------- */

const health = await (await fetch(`${BASE}/api/health/sarvam`)).json().catch(() => null);
if (health?.mode !== "simulate") {
  console.error(`Refusing to run: the server at ${BASE} is not in CALL_MODE=simulate (mode: ${health?.mode ?? "unknown"}).`);
  process.exit(1);
}
await cleanup();
console.log(`e2e against ${BASE} (simulate), tag "${TAG}"\n`);

// A. Workspace
let A;
await test("A", "first visit has no workspace and data routes ask for a name", async () => {
  const v = new Visitor();
  const w = await v.req("GET", "/api/workspace");
  expect(w.status === 200 && w.json?.workspace === null, `workspace ${w.status} ${w.text.slice(0, 80)}`);
  const f = await v.req("GET", "/api/family");
  expect(f.status === 401 && typeof f.json?.error === "string", `family ${f.status}`);
});
await test("A", "creating an account sets an httpOnly session cookie and starts empty", async () => {
  A = await workspace("A");
  const [f, r, c] = await Promise.all([A.req("GET", "/api/family"), A.req("GET", "/api/reminders"), A.req("GET", "/api/calls")]);
  expect(A.cookie.startsWith("yaad_session="), "no session cookie");
  expect(f.json.length === 0 && r.json.length === 0 && c.json.length === 0, "not empty");
});
await test("A", "a taken username is refused, whatever the case", async () => {
  const r = await new Visitor().req("POST", "/api/workspace", { name: `${TAG.toUpperCase()} a`, password: "another-pass-1" });
  expect(r.status === 409 && r.json?.error === "This username is already taken. Choose another one.", `${r.status} ${r.text.slice(0, 90)}`);
});
await test("A", "passwords must be at least 8 characters", async () => {
  const r = await new Visitor().req("POST", "/api/workspace", { name: `${TAG} short`, password: "1234567" });
  expect(r.status === 400 && /8 characters/.test(r.json?.error), `${r.status} ${r.text.slice(0, 90)}`);
});
await test("A", "log in on a second device with username and password; wrong password refused", async () => {
  await A.req("POST", "/api/family", { name: "Shared", phone: phone(), lang: "hi-IN" });
  const phone2 = new Visitor();
  const bad = await phone2.req("POST", "/api/workspace/login", { name: `${TAG} A`, password: "wrong-password" });
  expect(bad.status === 401 && bad.json?.error === "Wrong username or password.", `wrong pw ${bad.status}`);
  const ok = await phone2.req("POST", "/api/workspace/login", { name: `${TAG.toLowerCase()} a`, password: PASS });
  expect(ok.status === 200 && ok.json?.workspace?.id === A.id, `login ${ok.status} ${ok.text.slice(0, 80)}`);
  const fam = await phone2.req("GET", "/api/family");
  expect(fam.json.some((p) => p.name === "Shared"), "second device does not see the same data");
  const out = await phone2.req("POST", "/api/workspace/logout");
  const after = await phone2.req("GET", "/api/family");
  expect(out.status === 200 && after.status === 401, `logout ${out.status}, then ${after.status}`);
  const still = await A.req("GET", "/api/family");
  expect(still.status === 200, "logging out one device logged out the other");
  await A.req("DELETE", `/api/family/${fam.json.find((p) => p.name === "Shared").id}`);
});
await test("A", "an account without a password cannot be logged into; its owner can set one", async () => {
  const [legacy] = await db.insert("workspaces", [{ name: `${TAG} legacy` }]);
  await db.insert("settings", [{ workspace_id: legacy.id }]);
  const r = await new Visitor().req("POST", "/api/workspace/login", { name: `${TAG} legacy`, password: "anything-123" });
  expect(r.status === 403 && /no password yet/.test(r.json?.error), `${r.status} ${r.text.slice(0, 80)}`);
  const owner = new Visitor();
  owner.cookie = `yaad_ws=${legacy.id}`;
  const me = await owner.req("GET", "/api/workspace");
  expect(me.json?.workspace?.hasPassword === false, "owner not recognised by the old cookie");
  const set = await owner.req("POST", "/api/workspace/password", { password: "legacy-pass-1" });
  expect(set.status === 200 && set.json.workspace.hasPassword && owner.cookie.startsWith("yaad_session="), `set ${set.status}`);
  const other = new Visitor();
  const ok = await other.req("POST", "/api/workspace/login", { name: `${TAG} legacy`, password: "legacy-pass-1" });
  expect(ok.status === 200, `login after setting ${ok.status}`);
  const old = new Visitor();
  old.cookie = `yaad_ws=${legacy.id}`;
  const gone = await old.req("GET", "/api/workspace");
  expect(gone.json?.workspace === null, "the old cookie still works after a password was set");
});

// B. People
let amma;
await test("B", "create a person with an E.164 number", async () => {
  const r = await A.req("POST", "/api/family", { name: "Amma", relation: "Mother", phone: `+91${phone()}`, lang: "te-IN" });
  expect(r.status === 200, `${r.status} ${r.text.slice(0, 120)}`);
  amma = r.json;
  expect(/^[6-9]\d{9}$/.test(amma.phone), `stored phone ${amma.phone}`);
});
await test("B", "reject a bad number", async () => {
  const r = await A.req("POST", "/api/family", { name: "Bad", phone: "12345", lang: "hi-IN" });
  expect(r.status === 400 && /mobile number/.test(r.json?.error), `${r.status} ${r.text.slice(0, 80)}`);
});
await test("B", "refuse to call without consent", async () => {
  const rem = await reminder(A, amma.id, hhmm(Date.now() + 3 * 3600_000));
  const r = await A.req("POST", "/api/calls", { reminderId: rem.id });
  expect(r.status === 409 && /not agreed/.test(r.json?.error), `${r.status} ${r.text.slice(0, 80)}`);
  await A.req("DELETE", `/api/reminders/${rem.id}`);
});
await test("B", "enforce MAX_PEOPLE_PER_WORKSPACE (5)", async () => {
  for (let i = 0; i < 4; i++) await person(A, { name: `P${i}` }, false);
  const r = await A.req("POST", "/api/family", { name: "Sixth", phone: phone(), lang: "hi-IN" });
  expect(r.status === 409 && /up to 5/.test(r.json?.error), `${r.status} ${r.text.slice(0, 80)}`);
});

// C. Reminders
await test("C", "create, edit, pause, resume and delete a reminder 2 minutes ahead (IST)", async () => {
  const time = hhmm(Date.now() + 2 * 60_000);
  const rem = await reminder(A, amma.id, time);
  expect(rem.time === time, `time ${rem.time} != ${time}`);
  let r = await A.req("PATCH", `/api/reminders/${rem.id}`, { text: "Sugar tablet" });
  expect(r.status === 200 && r.json.text === "Sugar tablet", "edit");
  r = await A.req("PATCH", `/api/reminders/${rem.id}`, { active: false });
  expect(r.json.active === false, "pause");
  r = await A.req("PATCH", `/api/reminders/${rem.id}`, { active: true });
  expect(r.json.active === true, "resume");
  r = await A.req("DELETE", `/api/reminders/${rem.id}`);
  expect(r.status === 200, "delete");
  const list = await A.req("GET", "/api/reminders");
  expect(!list.json.some((x) => x.id === rem.id), "still listed");
});

// D. Scheduler materialise
let B, bPeople, slotCallId;
await test("D", "tick three times: exactly one call at the right UTC time", async () => {
  B = await workspace("B");
  // These tests are not about quiet hours; keep them valid at any time of day.
  await settings(B, { quietOn: false });
  bPeople = [await person(B, { name: "Amma" }), await person(B, { name: "Nanna" }), await person(B, { name: "Dadi", lang: "hi-IN" })];
  const time = hhmm(Date.now() + 60_000);
  const rem = await reminder(B, bPeople[0].id, time);
  for (let i = 0; i < 3; i++) {
    const t = await tick(B);
    expect(t.status === 200, `tick ${t.status}`);
  }
  const rows = await db.get("calls", `reminder_id=eq.${rem.id}&select=id,scheduled_at,status,attempt`);
  expect(rows.length === 1, `${rows.length} rows`);
  expect(new Date(rows[0].scheduled_at).getTime() === slotUtc(Date.now(), time), `scheduled_at ${rows[0].scheduled_at}`);
  expect(rows[0].status === "scheduled" && rows[0].attempt === 0, `status ${rows[0].status}`);
  slotCallId = rows[0].id;
  return `${time} IST -> ${rows[0].scheduled_at}`;
});

// E. Dispatch in simulate mode, all three demo outcomes
async function dispatchOutcome(callId, outcome, maxAttempts, expected) {
  await settings(B, { demoOutcome: outcome, maxAttempts });
  await db.update("calls", `id=eq.${callId}`, { next_attempt_at: iso(Date.now() - 1000) });
  const t = await tick(B);
  expect(t.json?.dialed >= 1, `dialed ${t.json?.dialed}`);
  const during = await call(callId);
  const attempts = await db.get("call_attempts", `call_id=eq.${callId}&select=status,sarvam_attempt_id`);
  expect(during.status === "calling" || during.status === expected, `status while ringing ${during.status}`);
  expect(attempts.length >= 1 && attempts[0].sarvam_attempt_id?.startsWith("sim_"), "no attempt row");
  const done = await waitFor(async () => {
    const c = await call(callId);
    return c.status !== "calling" ? c : null;
  });
  expect(done?.status === expected, `ended ${done?.status}, expected ${expected}`);
  return done;
}
await test("E", "demo_outcome taken -> confirmed (with a call_attempts row)", async () => {
  const c = await dispatchOutcome(slotCallId, "taken", 2, "confirmed");
  expect(c.lines.length > 0, "no transcript");
});
async function scheduledCall(v, p) {
  const [c] = await db.insert("calls", [
    { workspace_id: v.id, person_id: p.id, kind: "tablet", reminder_text: "BP tablet", lang: p.lang, scheduled_at: iso(Date.now() - 30_000 - Math.floor(Math.random() * 5000)), status: "scheduled", attempt: 0 },
  ]);
  return c.id;
}
await test("E", "demo_outcome noanswer with attempts left -> retry", async () => {
  const id = await scheduledCall(B, bPeople[1]);
  const c = await dispatchOutcome(id, "noanswer", 2, "retry");
  expect(c.next_attempt_at && new Date(c.next_attempt_at) > Date.now(), "no next attempt");
});
await test("E", "demo_outcome noanswer on the last attempt -> missed", async () => {
  const id = await scheduledCall(B, bPeople[2]);
  await dispatchOutcome(id, "noanswer", 1, "missed");
});

// F. Retry flow
await test("F", "later_minutes=10 reschedules ~10 minutes ahead; the next dial increments attempt; last attempt -> missed with one alert", async () => {
  const C = await workspace("C");
  const p = await person(C, { name: "Paati", lang: "ta-IN" });
  await settings(C, { maxAttempts: 2, demoOutcome: "noanswer", quietOn: false });
  const { callId, attemptId } = await ringing(C, p);
  const h = await hook({ attempt_id: attemptId, status: "connected", duration: 20, final_agent_variables: { response: "later", later_minutes: 10 } });
  expect(h.status === 200, `webhook ${h.status}`);
  let c = await call(callId);
  const ahead = (new Date(c.next_attempt_at) - Date.now()) / 60_000;
  expect(c.status === "retry" && c.later_min === 10 && ahead > 9 && ahead <= 10.1, `status ${c.status} later ${c.later_min} ahead ${ahead.toFixed(2)}`);
  // Make the retry due, and the last attempt old enough for the cooldown.
  await db.update("calls", `id=eq.${callId}`, { next_attempt_at: iso(Date.now() - 1000) });
  await db.update("call_attempts", `sarvam_attempt_id=eq.${attemptId}`, { created_at: iso(Date.now() - 5 * 60_000) });
  const t = await tick(C);
  expect(t.json?.dialed === 1, `dialed ${t.json?.dialed}`);
  c = await waitFor(async () => {
    const x = await call(callId);
    return x.status === "missed" ? x : null;
  });
  expect(c && c.attempt === 2, `attempt ${c?.attempt} status ${c?.status}`);
  await tick(C);
  const alerts = await db.get("alerts", `workspace_id=eq.${C.id}&select=kind,message`);
  expect(alerts.length === 1 && alerts[0].kind === "missed", `${alerts.length} alerts`);
  return alerts[0].message;
});

// G. Webhook
let D, dp;
await test("G", "wrong or missing token -> 401", async () => {
  D = await workspace("D");
  dp = await person(D, { name: "Ajji", lang: "kn-IN" });
  const a = await hook({ attempt_id: "x", status: "connected" }, "wrong");
  const b = await hook({ attempt_id: "x", status: "connected" }, null);
  expect(a.status === 401 && b.status === 401, `${a.status} ${b.status}`);
});
await test("G", "unknown attempt_id -> 200 and nothing changes", async () => {
  const { attemptId } = await ringing(D, dp);
  const r = await hook({ attempt_id: `qa_unknown_${randomUUID()}`, status: "connected", final_agent_variables: { response: "yes" } });
  const still = await db.get("call_attempts", `sarvam_attempt_id=eq.${attemptId}&select=status`);
  expect(r.status === 200 && still[0].status === "dialing", `${r.status} ${still[0].status}`);
});
let yesCall, yesPayload;
await test("G", "connected + yes -> confirmed, English transcript and summary saved", async () => {
  const { callId, attemptId } = await ringing(D, dp, { ageMs: 6 * 60_000 });
  yesCall = callId;
  yesPayload = {
    attempt_id: attemptId,
    status: "connected",
    duration: 31,
    interaction_id: "int_qa",
    final_agent_variables: { response: "Yes", later_minutes: null, unwell: "false", call_summary: "Ajji confirmed the BP tablet." },
    interaction_transcript: [
      { role: "agent", en_text: "Ajji, it's time for your BP tablet. Have you taken it?" },
      { role: "user", en_text: "Yes, I took it." },
    ],
  };
  const r = await hook(yesPayload);
  const c = await call(callId);
  expect(r.status === 200 && c.status === "confirmed", `${r.status} ${c.status}`);
  expect(c.lines.length === 2 && c.lines[1].english === "Yes, I took it." && c.lines[0].role === "agent", "transcript");
  expect(c.response_note === "Ajji confirmed the BP tablet." && c.duration_sec === 31, "summary/duration");
});
await test("G", "the same payload twice changes nothing", async () => {
  const before = await call(yesCall);
  const r = await hook(yesPayload);
  const after = await call(yesCall);
  expect(r.status === 200 && after.duration_sec === before.duration_sec && after.status === before.status, "changed");
});
for (const status of ["no_answer", "busy", "failed"]) {
  await test("G", `${status}: retry, then missed on the last attempt`, async () => {
    await settings(D, { maxAttempts: 2 });
    const { callId, attemptId } = await ringing(D, dp, { ageMs: 7 * 60_000 });
    await hook({ attempt_id: attemptId, status, failure_reason: status === "failed" ? "carrier_error" : undefined });
    let c = await call(callId);
    expect(c.status === "retry", `first ${c.status}`);
    const second = await nextAttempt(D, callId, 2, 6 * 60_000);
    await hook({ attempt_id: second, status });
    c = await call(callId);
    expect(c.status === "missed" && c.failure_reason, `second ${c.status} ${c.failure_reason}`);
  });
}
await test("G", "unwell=true -> family alert", async () => {
  const { callId, attemptId } = await ringing(D, dp, { ageMs: 8 * 60_000 });
  await hook({ attempt_id: attemptId, status: "connected", final_agent_variables: { response: "yes", unwell: true } });
  const alerts = await db.get("alerts", `call_id=eq.${callId}&select=kind`);
  expect(alerts.length === 1 && alerts[0].kind === "unwell", `${alerts.length} alerts`);
});
await test("G", "extra and missing fields do not crash; a payload without attempt_id -> 400", async () => {
  const { attemptId } = await ringing(D, dp, { ageMs: 9 * 60_000 });
  const a = await hook({ attempt_id: attemptId, status: "CONNECTED", unexpected: { nested: [1, 2] }, final_agent_variables: { something_else: 1 } });
  const b = await hook({ status: "connected" });
  const c = await hook("not json");
  expect(a.status === 200 && b.status === 400 && c.status === 400, `${a.status} ${b.status} ${c.status}`);
});

// H. Safety gates
await test("H", "quiet hours reschedule a scheduled call to when they end", async () => {
  const E = await workspace("E");
  const p = await person(E, { name: "Nani", lang: "hi-IN" });
  const to = hhmm(Date.now() + 60 * 60_000);
  await settings(E, { quietOn: true, quietFrom: hhmm(Date.now() - 60 * 60_000), quietTo: to });
  const id = await scheduledCall(E, p);
  const t = await tick(E);
  const c = await call(id);
  expect(t.json?.dialed === 1 && c.status === "scheduled", `dialed ${t.json?.dialed} status ${c.status}`);
  expect(new Date(c.next_attempt_at).getTime() === slotUtc(Date.now(), to), `next ${c.next_attempt_at}`);
});
await test("H", "two-minute cooldown per number, across workspaces", async () => {
  const shared = phone();
  const F1 = await workspace("F1");
  const F2 = await workspace("F2");
  const p1 = await person(F1, { name: "Amma", phone: shared });
  const p2 = await person(F2, { name: "Amma", phone: shared });
  const r1 = await reminder(F1, p1.id, "23:30");
  const r2 = await reminder(F2, p2.id, "23:30");
  const a = await F1.req("POST", "/api/calls", { reminderId: r1.id });
  const b = await F2.req("POST", "/api/calls", { reminderId: r2.id });
  expect(a.status === 200, `first ${a.status} ${a.text.slice(0, 80)}`);
  expect(b.status === 429 && /two minutes/.test(b.json?.error), `second ${b.status} ${b.text.slice(0, 80)}`);
});
await test("H", "per-workspace daily cap: 'Demo limit reached for today' and failure_reason daily_limit", async () => {
  const G = await workspace("G");
  const p = await person(G, { name: "Thatha", lang: "ta-IN" });
  const [dummy] = await db.insert("calls", [{ workspace_id: G.id, person_id: p.id, kind: "tablet", reminder_text: "x", lang: "ta-IN", scheduled_at: iso(Date.now() - 3 * 3600_000), status: "confirmed", attempt: 1 }]);
  await db.insert(
    "call_attempts",
    Array.from({ length: 8 }, (_, i) => ({ workspace_id: G.id, call_id: dummy.id, attempt_no: i + 1, status: "connected", created_at: iso(Date.now() - (20 + i) * 60_000) })),
  );
  const rem = await reminder(G, p.id, "23:45");
  const r = await G.req("POST", "/api/calls", { reminderId: rem.id });
  expect(r.status === 429 && r.json?.error === "Demo limit reached for today.", `${r.status} ${r.text.slice(0, 80)}`);
  const id = await scheduledCall(G, p);
  await tick(G);
  const c = await call(id);
  expect(c.status === "missed" && c.failure_reason === "daily_limit", `${c.status} ${c.failure_reason}`);
  return "global cap and the allowlist (live mode only) are covered by unit tests";
});

// I. Tick auth
await test("I", "tick without the dev secret or a QStash signature -> 401", async () => {
  const a = await tick(null, null);
  const b = await tick(null, "Bearer wrong");
  const c = await fetch(`${BASE}/api/cron/tick`, { method: "POST", headers: { "upstash-signature": "fake.jwt.sig" } });
  expect(a.status === 401 && b.status === 401 && c.status === 401, `${a.status} ${b.status} ${c.status}`);
  return "dev secret refused when NODE_ENV=production: unit test";
});

// J. Recovery
await test("J", "attempt stuck in dialing for 10+ minutes -> failed (webhook_timeout), call retries", async () => {
  const J = await workspace("J");
  const p = await person(J, { name: "Mama", lang: "kn-IN" });
  await settings(J, { maxAttempts: 2, quietOn: false });
  const { callId, attemptId } = await ringing(J, p, { ageMs: 11 * 60_000 });
  const t = await tick(J);
  const [a] = await db.get("call_attempts", `sarvam_attempt_id=eq.${attemptId}&select=status,failure_reason`);
  const c = await call(callId);
  expect(t.json?.recovered === 1 && a.status === "failed" && a.failure_reason === "webhook_timeout", `recovered ${t.json?.recovered} ${a.status} ${a.failure_reason}`);
  expect(c.status === "retry" || c.status === "calling", `call ${c.status}`);
});

// K. API errors
await test("K", "bad input returns clean JSON errors without stack traces", async () => {
  const uuid = randomUUID();
  const cases = [
    ["POST", "/api/family", "{"],
    ["POST", "/api/family", { name: "", phone: "1", lang: "xx" }],
    ["PATCH", "/api/family/not-a-uuid", { name: "X" }],
    ["DELETE", `/api/family/${uuid}`],
    ["POST", `/api/family/${uuid}/consent`, { status: "maybe" }],
    ["POST", "/api/reminders", {}],
    ["PATCH", `/api/reminders/${uuid}`, { time: "25:99" }],
    ["DELETE", "/api/reminders/not-a-uuid"],
    ["PUT", "/api/settings", { retryMin: 7 }],
    ["POST", "/api/calls", {}],
    ["POST", `/api/calls/${uuid}/dial`],
    ["POST", "/api/workspace", { name: "" }],
    ["POST", "/api/workspace/login", {}],
    ["POST", "/api/workspace/password", { password: "short" }],
    ["POST", "/api/tts", {}],
    ["POST", "/api/seed"],
  ];
  const bad = [];
  for (const [method, path, body] of cases) {
    const r = await A.req(method, path, body);
    const clean = r.status >= 400 && r.status < 500 && r.type.includes("json") && typeof r.json?.error === "string" && !/\bat\s+\S+\s*\(|\.tsx?:\d+|node_modules/.test(r.text);
    if (!clean) bad.push(`${method} ${path} -> ${r.status} ${r.text.slice(0, 60)}`);
  }
  expect(!bad.length, bad.join(" | "));
  return `${cases.length} cases`;
});

await cleanup();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
