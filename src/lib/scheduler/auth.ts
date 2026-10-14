// Who may run the scheduler tick.

import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type TickAuthInput = {
  nodeEnv: string | undefined;
  authorization: string | null;
  devSecret: string | undefined;
  signature: string | null;
  /** Verifies the QStash signature over the raw body. */
  verifySignature: (signature: string) => Promise<boolean>;
};

/**
 * Production: only a valid QStash signature. Development: also a bearer
 * CRON_DEV_SECRET, so `pnpm tick` works. The bearer is never honoured in production.
 */
export async function authorizeTick(i: TickAuthInput): Promise<boolean> {
  if (i.nodeEnv !== "production" && i.devSecret && i.authorization?.startsWith("Bearer ")) {
    if (safeEqual(i.authorization.slice(7), i.devSecret)) return true;
  }
  if (!i.signature) return false;
  try {
    return await i.verifySignature(i.signature);
  } catch {
    return false;
  }
}
