// Step C: attempts stuck in 'dialing' mean the webhook never arrived.

import type { WebhookPayload } from "../calls/webhook";

export const STALE_MS = 10 * 60_000;

type Claimed = { callId: string; workspaceId: string; attemptNo: number };

export type RecoverDeps = {
  /** Attempt row ids with status 'dialing' created before `before`. */
  listStale: (before: number) => Promise<string[]>;
  /** UPDATE ... SET status='failed' WHERE id=$1 AND status='dialing' RETURNING. */
  claim: (attemptRowId: string, payload: WebhookPayload) => Promise<Claimed | null>;
  /** The same failure path as a webhook: retry or missed. */
  apply: (claimed: Claimed, payload: WebhookPayload) => Promise<void>;
};

export async function recoverStale(deps: RecoverDeps, now = Date.now()) {
  let recovered = 0;
  for (const id of await deps.listStale(now - STALE_MS)) {
    const payload: WebhookPayload = { attempt_id: id, status: "failed", failure_reason: "webhook_timeout" };
    const claimed = await deps.claim(id, payload);
    if (!claimed) continue;
    try {
      await deps.apply(claimed, payload);
      recovered++;
    } catch (err) {
      console.error("[scheduler] recover failed", (err as Error).message);
    }
  }
  return recovered;
}
