// Webhook parsing, auth and handling. Storage is injected so the flow can be
// unit tested without a database.

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AttemptStatus } from "./resolve";

/** Constant-time comparison of the ?token= query value with the secret. */
export function verifyToken(given: string | null, secret: string | undefined) {
  if (!given || !secret) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const loose = z.union([z.string(), z.number(), z.boolean()]).nullish();

export const webhookPayload = z
  .object({
    attempt_id: z.string().min(1),
    status: z.string().transform((s) => s.toLowerCase()),
    duration: z.coerce.number().nullish(),
    interaction_id: z.string().nullish(),
    failure_reason: z.string().nullish(),
    final_agent_variables: z
      .object({ response: loose, later_minutes: loose, unwell: loose, call_summary: loose })
      .partial()
      .loose()
      .nullish(),
    interaction_transcript: z
      .array(z.object({ role: z.string().nullish(), en_text: z.string().nullish(), text: z.string().nullish() }).loose())
      .nullish(),
    webhook_config: z.object({ metadata: z.record(z.string(), z.unknown()).nullish() }).loose().nullish(),
  })
  .loose();

export type WebhookPayload = z.infer<typeof webhookPayload>;

export function attemptStatusOf(raw: string): AttemptStatus {
  if (raw === "connected" || raw === "completed" || raw === "answered") return "connected";
  if (raw === "no_answer" || raw === "noanswer" || raw === "no-answer" || raw === "unanswered") return "no_answer";
  if (raw === "busy") return "busy";
  return "failed";
}

export type WebhookDeps = {
  secret: string | undefined;
  /** Atomically marks the attempt finished if it is still dialing. Returns null when unknown or already handled. */
  claimAttempt: (attemptId: string, payload: WebhookPayload) => Promise<{ callId: string; workspaceId: string; attemptNo: number } | null>;
  applyResult: (claimed: { callId: string; workspaceId: string; attemptNo: number }, payload: WebhookPayload) => Promise<void>;
};

export type WebhookResult = { status: 200 | 400 | 401; body: Record<string, unknown> };

export async function handleWebhook(token: string | null, raw: unknown, deps: WebhookDeps): Promise<WebhookResult> {
  if (!verifyToken(token, deps.secret)) return { status: 401, body: { error: "Unauthorized." } };
  const parsed = webhookPayload.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "Unexpected payload." } };

  const claimed = await deps.claimAttempt(parsed.data.attempt_id, parsed.data);
  // Unknown attempt or a duplicate delivery: acknowledge and do nothing.
  if (!claimed) return { status: 200, body: { ok: true } };

  await deps.applyResult(claimed, parsed.data);
  return { status: 200, body: { ok: true } };
}
