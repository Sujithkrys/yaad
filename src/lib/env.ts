import "server-only";

import { z } from "zod";

// Server-only configuration. Values never reach the browser; the Sarvam
// health route reports only which ones are set.

const csv = z
  .string()
  .default("")
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean));

const schema = z.object({
  SARVAM_API_KEY: z.string().trim().min(1).optional(),
  SARVAM_ORG_ID: z.string().trim().min(1).optional(),
  SARVAM_WORKSPACE_ID: z.string().trim().min(1).optional(),
  SARVAM_APP_ID: z.string().trim().min(1).optional(),
  SARVAM_APP_VERSION: z.coerce.number().int().positive().optional(),
  SARVAM_APP_TYPE: z.literal("agent").default("agent"),
  SARVAM_CONNECTION_ID: z.string().trim().min(1).optional(),
  SARVAM_AGENT_PHONE: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "SARVAM_AGENT_PHONE must be E.164").optional(),
  SARVAM_WEBHOOK_SECRET: z.string().trim().min(24, "SARVAM_WEBHOOK_SECRET must be at least 24 characters").optional(),
  APP_BASE_URL: z.url().optional(),
  CALL_MODE: z.enum(["live", "simulate"]).default("simulate"),
  CALL_ALLOWLIST: csv,
  MAX_CALLS_PER_DAY: z.coerce.number().int().positive().default(40),
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

export function env(): Env {
  if (cached) return cached;
  // Blank values in .env files mean "not set".
  const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid call configuration: ${names}`);
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
