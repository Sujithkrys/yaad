import { connection } from "next/server";
import { env, EnvError, liveConfig } from "@/lib/env";

/** Which call settings are present, as booleans only. Never returns values. */
export async function GET() {
  await connection();
  try {
    const { configured, ready } = liveConfig();
    return Response.json({ mode: env().CALL_MODE, ready, configured, allowlist: env().CALL_ALLOWLIST.length });
  } catch (err) {
    const invalid = err instanceof EnvError ? err.keys : undefined;
    return Response.json({ mode: "unknown", ready: false, error: "Call settings are not valid.", invalid }, { status: 500 });
  }
}
