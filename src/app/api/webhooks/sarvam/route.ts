import { applyResult, claimAttempt } from "@/lib/calls/apply";
import { handleWebhook } from "@/lib/calls/webhook";
import { env } from "@/lib/env";

// Sarvam does not sign webhooks, so the URL carries a secret ?token=.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  try {
    const result = await handleWebhook(token, body, {
      secret: env().SARVAM_WEBHOOK_SECRET,
      claimAttempt,
      applyResult,
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    // Database trouble: 500 so Sarvam retries. No payload or PII in the log.
    console.error("[webhook] failed", (err as Error).message);
    return Response.json({ error: "Temporary failure." }, { status: 500 });
  }
}
