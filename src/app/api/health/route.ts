import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { error } = await supabaseAdmin().from("workspaces").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "The database is not reachable." }, { status: 503 });
  }
}
