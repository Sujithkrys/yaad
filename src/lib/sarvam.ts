import "server-only";

import { env } from "./env";

// Sarvam Voice Agents: Instant Outbound API.

const TIMEOUT_MS = 15_000;

export class SarvamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Response body, trimmed. Never contains our API key. */
    public readonly body: string,
  ) {
    super(message);
    this.name = "SarvamError";
  }
}

export type AgentVariables = {
  person_name: string;
  reminder_text: string;
  requester_name: string;
  user_name: string;
};

export type PlaceCallInput = {
  /** E.164, e.g. +919876543210 */
  phone: string;
  /** "Telugu", "Hindi", ... */
  languageName: string;
  openingLine: string;
  variables: AgentVariables;
  metadata: { call_id: string; attempt_no: number; workspace_id: string };
};

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new SarvamError(`${name} is not set.`, 0, "");
  return value;
}

/** Builds the exact request body. Exported for tests and the call:test script. */
export function outboundBody(input: PlaceCallInput) {
  const e = env();
  return {
    app_config: {
      app_id: required(e.SARVAM_APP_ID, "SARVAM_APP_ID"),
      app_version: required(e.SARVAM_APP_VERSION, "SARVAM_APP_VERSION"),
      app_type: "agent",
      connection_config: {
        connection_id: required(e.SARVAM_CONNECTION_ID, "SARVAM_CONNECTION_ID"),
        agent_phone_number: required(e.SARVAM_AGENT_PHONE, "SARVAM_AGENT_PHONE"),
      },
      agent_variables: input.variables,
      app_overrides: { initial_bot_message: input.openingLine, initial_language_name: input.languageName },
    },
    user_config: { user_phone_number: input.phone },
    webhook_config: {
      url: `${required(e.APP_BASE_URL, "APP_BASE_URL").replace(/\/$/, "")}/api/webhooks/sarvam?token=${encodeURIComponent(
        required(e.SARVAM_WEBHOOK_SECRET, "SARVAM_WEBHOOK_SECRET"),
      )}`,
      metadata: input.metadata,
    },
  };
}

/**
 * Places one outbound call. No automatic retry: a repeated POST could ring the
 * person twice. Returns Sarvam's attempt id.
 */
export async function placeCall(input: PlaceCallInput): Promise<{ attemptId: string }> {
  const e = env();
  const key = required(e.SARVAM_API_KEY, "SARVAM_API_KEY");
  const url = `https://apps.sarvam.ai/api/outbounds/v1/orgs/${required(e.SARVAM_ORG_ID, "SARVAM_ORG_ID")}/workspaces/${required(
    e.SARVAM_WORKSPACE_ID,
    "SARVAM_WORKSPACE_ID",
  )}/outbounds`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": key },
      body: JSON.stringify(outboundBody(input)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new SarvamError(`Could not reach Sarvam (${(err as Error).name}).`, 0, "");
  }

  const text = await res.text();
  if (!res.ok) throw new SarvamError(`Sarvam refused the call (${res.status}).`, res.status, text.slice(0, 500));
  let attemptId: unknown;
  try {
    attemptId = (JSON.parse(text) as { attempt_id?: unknown }).attempt_id;
  } catch {
    // fall through
  }
  if (typeof attemptId !== "string" || !attemptId) throw new SarvamError("Sarvam did not return an attempt id.", res.status, text.slice(0, 500));
  return { attemptId };
}
