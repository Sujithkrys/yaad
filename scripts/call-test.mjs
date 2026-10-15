// Places one real outbound call through Sarvam to check the setup.
// Usage: pnpm call:test +91XXXXXXXXXX [lang]   (lang: hi, te, ta, kn, en; default hi)
// Refuses numbers that are not in CALL_ALLOWLIST. Never prints secrets.

const { renderGreeting } = await import("../src/lib/greetings.ts");

const LANGS = { hi: "Hindi", te: "Telugu", ta: "Tamil", kn: "Kannada", en: "English" };

function normalizePhone(raw) {
  const m = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(String(raw ?? "").replace(/[\s-()]/g, ""));
  return m ? `+91${m[1]}` : null;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const phone = normalizePhone(process.argv[2]);
if (!phone) fail("Usage: pnpm call:test +91XXXXXXXXXX [hi|te|ta|kn|en]");
const lang = (process.argv.slice(3).find((a) => !a.startsWith("--")) ?? "hi").slice(0, 2).toLowerCase();
if (!LANGS[lang]) fail(`Unknown language "${lang}". Use one of: ${Object.keys(LANGS).join(", ")}.`);

const dryRun = process.argv.includes("--dry-run");
const allow = (process.env.CALL_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
// Empty allowlist = open mode, same as the app. A set list must include the number.
if (allow.length && !allow.includes(phone)) fail(`${phone} is not in CALL_ALLOWLIST.`);

const need = ["SARVAM_API_KEY", "SARVAM_ORG_ID", "SARVAM_WORKSPACE_ID", "SARVAM_APP_ID", "SARVAM_APP_VERSION", "SARVAM_CONNECTION_ID", "SARVAM_AGENT_PHONE"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) fail(`Missing in .env.local: ${missing.join(", ")}`);

const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
const secret = process.env.SARVAM_WEBHOOK_SECRET ?? "";
if (!base) console.warn("APP_BASE_URL is empty: the call will ring, but no result will reach the app.");

const body = {
  app_config: {
    app_id: process.env.SARVAM_APP_ID,
    app_version: Number(process.env.SARVAM_APP_VERSION),
    app_type: "agent",
    connection_config: { connection_id: process.env.SARVAM_CONNECTION_ID, agent_phone_number: process.env.SARVAM_AGENT_PHONE },
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
if (dryRun) {
  const mask = (v) => (v ? `${String(v).slice(0, 4)}***` : "(not set)");
  const shown = structuredClone(body);
  shown.webhook_config.url = shown.webhook_config.url.replace(/token=[^&]+/, "token=***");
  shown.user_config.user_phone_number = `${phone.slice(0, 5)}*****${phone.slice(-2)}`;
  console.log("DRY RUN: nothing was sent.");
  console.log(`POST ${url.replace(process.env.SARVAM_ORG_ID, mask(process.env.SARVAM_ORG_ID)).replace(process.env.SARVAM_WORKSPACE_ID, mask(process.env.SARVAM_WORKSPACE_ID))}`);
  console.log(`X-API-Key: ${mask(process.env.SARVAM_API_KEY)}`);
  console.log(JSON.stringify(shown, null, 2));
  process.exit(0);
}

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
