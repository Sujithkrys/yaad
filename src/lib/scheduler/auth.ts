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
 * Returns how the caller was authorised, or null.
 */
export async function tickCaller(i: TickAuthInput): Promise<"dev" | "qstash" | null> {
  if (i.nodeEnv !== "production" && i.devSecret && i.authorization?.startsWith("Bearer ")) {
    if (safeEqual(i.authorization.slice(7), i.devSecret)) return "dev";
  }
  if (!i.signature) return null;
  try {
    return (await i.verifySignature(i.signature)) ? "qstash" : null;
  } catch {
    return null;
  }
}

export async function authorizeTick(i: TickAuthInput): Promise<boolean> {
  return (await tickCaller(i)) !== null;
}
