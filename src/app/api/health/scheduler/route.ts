import { connection } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Last tick time and how many calls are waiting, for the Settings chip. No personal data. */
export async function GET() {
  await connection();
  try {
    const db = supabaseAdmin();
    const count = (status: string) => db.from("calls").select("id", { count: "exact", head: true }).eq("status", status);
    const [state, scheduled, retry, calling] = await Promise.all([
      db.from("app_state").select("value, updated_at").eq("key", "scheduler").maybeSingle(),
      count("scheduled"),
      count("retry"),
      count("calling"),
    ]);
    const value = (state.data?.value ?? {}) as { lastTickAt?: string; result?: unknown };
    return Response.json({
      lastTickAt: value.lastTickAt ?? null,
      secondsSinceTick: value.lastTickAt ? Math.round((Date.now() - new Date(value.lastTickAt).getTime()) / 1000) : null,
      lastResult: value.result ?? null,
      counts: { scheduled: scheduled.count ?? 0, retry: retry.count ?? 0, calling: calling.count ?? 0 },
    });
  } catch {
    return Response.json({ error: "Scheduler status is not available." }, { status: 503 });
  }
}
