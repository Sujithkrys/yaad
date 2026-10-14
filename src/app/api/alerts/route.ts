import { dbError, route } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** The in-app alert feed for the bell. */
export const GET = route(async ({ ws }) => {
  const { data, error } = await supabaseAdmin()
    .from("alerts")
    .select("id, kind, message, created_at, read_at")
    .eq("workspace_id", ws)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw dbError(error);
  const alerts = data.map((a) => ({ id: a.id, kind: a.kind, message: a.message, createdAt: a.created_at, read: Boolean(a.read_at) }));
  return { alerts, unread: alerts.filter((a) => !a.read).length };
});
