import "server-only";

import { z } from "zod";
import { toE164 } from "./phone";

// Server-only configuration. Values never reach the browser; the Sarvam
// health route reports only which ones are set.

// A phone number in a config value, accepted in any common way of writing it
// ("+91 98765 43210", "919876543210", "9876543210") and stored as E.164.
const e164 = (name: string) =>
  z.string().transform((s, ctx) => {
    const n = toE164(s);
    if (!n) ctx.addIssue({ code: "custom", message: `${name} must be a phone number like +919876543210` });
    return n ?? s;
  });

const phoneList = z
  .string()
  .default("")
  .transform((s, ctx) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const n = toE164(x);
        if (!n) ctx.addIssue({ code: "custom", message: "CALL_ALLOWLIST has an entry that is not a phone number" });
        return n ?? x;
      }),
  );

const schema = z.object({
  SARVAM_API_KEY: z.string().trim().min(1).optional(),
  SARVAM_ORG_ID: z.string().trim().min(1).optional(),
  SARVAM_WORKSPACE_ID: z.string().trim().min(1).optional(),
  SARVAM_APP_ID: z.string().trim().min(1).optional(),
  SARVAM_APP_VERSION: z.coerce.number().int().positive().optional(),
  SARVAM_APP_TYPE: z.literal("agent").default("agent"),
  SARVAM_CONNECTION_ID: z.string().trim().min(1).optional(),
  SARVAM_AGENT_PHONE: e164("SARVAM_AGENT_PHONE").optional(),
  SARVAM_WEBHOOK_SECRET: z.string().trim().min(24, "SARVAM_WEBHOOK_SECRET must be at least 24 characters").optional(),
  APP_BASE_URL: z.url().optional(),
  CALL_MODE: z.enum(["live", "simulate"]).default("simulate"),
  CALL_ALLOWLIST: phoneList,
  MAX_CALLS_PER_DAY: z.coerce.number().int().positive().default(40),
  MAX_CALLS_PER_WORKSPACE_PER_DAY: z.coerce.number().int().positive().default(8),
  MAX_PEOPLE_PER_WORKSPACE: z.coerce.number().int().positive().default(5),

  QSTASH_URL: z.url().optional(),
  QSTASH_TOKEN: z.string().trim().min(1).optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().trim().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().trim().min(1).optional(),
  /** Only honoured when NODE_ENV !== "production". */
  CRON_DEV_SECRET: z.string().trim().min(16, "CRON_DEV_SECRET must be at least 16 characters").optional(),

  RESEND_API_KEY: z.string().trim().min(1).optional(),
  ALERT_FROM_EMAIL: z.string().trim().min(3).optional(),
});

export type Env = z.infer<typeof schema>;

// Required for live calls.
export const LIVE_KEYS = [
  "SARVAM_API_KEY",
  "SARVAM_ORG_ID",
  "SARVAM_WORKSPACE_ID",
  "SARVAM_APP_ID",
  "SARVAM_APP_VERSION",
  "SARVAM_CONNECTION_ID",
  "SARVAM_AGENT_PHONE",
  "SARVAM_WEBHOOK_SECRET",
  "APP_BASE_URL",
] as const;

let cached: Env | null = null;

/** Thrown when settings fail validation. Carries variable names only, never values. */
export class EnvError extends Error {
  constructor(readonly keys: string[]) {
    super(`Invalid call configuration: ${keys.join(", ")}`);
  }
}

// Values pasted into a hosting dashboard often carry a trailing newline or
// wrapping quotes; strip both. Blank values mean "not set".
function clean(v: string | undefined) {
  if (v === undefined) return undefined;
  const t = v.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return t === "" ? undefined : t;
}

export function env(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, clean(v)]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    console.error("[env]", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    throw new EnvError(keys);
  }
  cached = parsed.data;
  return cached;
}

/** Which live-call settings are present. Booleans only, never values. */
export function liveConfig() {
  const e = env();
  const configured = Object.fromEntries(LIVE_KEYS.map((k) => [k, e[k] !== undefined])) as Record<(typeof LIVE_KEYS)[number], boolean>;
  return { configured, ready: Object.values(configured).every(Boolean) };
}
