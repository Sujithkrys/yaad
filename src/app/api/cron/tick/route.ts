import { Receiver } from "@upstash/qstash";
import { env } from "@/lib/env";
import { authorizeTick } from "@/lib/scheduler/auth";
import { runTick } from "@/lib/scheduler/tick";

export const maxDuration = 30;

/** QStash calls this every two minutes. Idempotent: retries and overlaps are safe. */
export async function POST(request: Request) {
  const e = env();
  const body = await request.text();
  const ok = await authorizeTick({
    nodeEnv: process.env.NODE_ENV,
    authorization: request.headers.get("authorization"),
    devSecret: e.CRON_DEV_SECRET,
    signature: request.headers.get("upstash-signature"),
    verifySignature: (signature) => {
      if (!e.QSTASH_CURRENT_SIGNING_KEY || !e.QSTASH_NEXT_SIGNING_KEY) return Promise.resolve(false);
      const receiver = new Receiver({ currentSigningKey: e.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: e.QSTASH_NEXT_SIGNING_KEY, devMode: false });
      return receiver.verify({ signature, body, clockTolerance: 5 });
    },
  });
  if (!ok) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    return Response.json(await runTick());
  } catch (err) {
    console.error("[tick] failed", (err as Error).message);
    return Response.json({ error: "Tick failed." }, { status: 500 });
  }
}
