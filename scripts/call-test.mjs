// Places one real outbound call through Sarvam to check the setup.
// Usage: pnpm call:test +91XXXXXXXXXX [lang]   (lang: hi, te, ta, kn, en; default hi)
// Refuses numbers that are not in CALL_ALLOWLIST. Never prints secrets.

const { renderGreeting } = await import("../src/lib/greetings.ts");
const { normalizePhone, toE164 } = await import("../src/lib/phone.ts");

const LANGS = { hi: "Hindi", te: "Telugu", ta: "Tamil", kn: "Kannada", en: "English" };

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const phone = normalizePhone(process.argv[2] ?? "");
if (!phone) fail("Usage: pnpm call:test +91XXXXXXXXXX [hi|te|ta|kn|en]");
const lang = (process.argv[3] ?? "hi").slice(0, 2).toLowerCase();
if (!LANGS[lang]) fail(`Unknown language "${lang}". Use one of: ${Object.keys(LANGS).join(", ")}.`);

const allow = (process.env.CALL_ALLOWLIST ?? "").split(",").map((s) => toE164(s.trim())).filter(Boolean);
if (!allow.includes(phone)) fail(`${phone} is not in CALL_ALLOWLIST. Add it to .env.local first.`);

const need = ["SARVAM_API_KEY", "SARVAM_ORG_ID", "SARVAM_WORKSPACE_ID", "SARVAM_APP_ID", "SARVAM_APP_VERSION", "SARVAM_CONNECTION_ID", "SARVAM_AGENT_PHONE"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) fail(`Missing in .env.local: ${missing.join(", ")}`);

const agentPhone = toE164(process.env.SARVAM_AGENT_PHONE);
if (!agentPhone) fail("SARVAM_AGENT_PHONE is not a phone number. Use the agent's number, e.g. +918012345678.");

const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
const secret = process.env.SARVAM_WEBHOOK_SECRET ?? "";
if (!base) console.warn("APP_BASE_URL is empty: the call will ring, but no result will reach the app.");

const body = {
  app_config: {
    app_id: process.env.SARVAM_APP_ID,
    app_version: Number(process.env.SARVAM_APP_VERSION),
    app_type: "agent",
    connection_config: { connection_id: process.env.SARVAM_CONNECTION_ID, agent_phone_number: agentPhone },
    agent_variables: { person_name: "Test", reminder_text: "BP tablet", requester_name: "Yaad", user_name: "Yaad" },
    app_overrides: { initial_bot_message: renderGreeting(lang, "Test", "BP tablet"), initial_language_name: LANGS[lang] },
  },
  user_config: { user_phone_number: phone },
  webhook_config: {
    url: `${base || "https://example.invalid"}/api/webhooks/sarvam?token=${encodeURIComponent(secret)}`,
    metadata: { call_id: "call-test", attempt_no: 1, workspace_id: "call-test" },
  },
};

const url = `https://apps.sarvam.ai/api/outbounds/v1/orgs/${process.env.SARVAM_ORG_ID}/workspaces/${process.env.SARVAM_WORKSPACE_ID}/outbounds`;
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-API-Key": process.env.SARVAM_API_KEY },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(15_000),
});
const text = await res.text();
let json = {};
try {
  json = JSON.parse(text);
} catch {}
console.log(`status:     ${res.status}`);
console.log(`attempt_id: ${json.attempt_id ?? "none"}`);
console.log(`to:         ${phone.slice(0, 5)}*****${phone.slice(-2)} in ${LANGS[lang]}`);
if (!res.ok) {
  console.log(`error:      ${(json.detail ?? json.message ?? json.error ?? text).toString().slice(0, 300)}`);
  process.exit(1);
}
