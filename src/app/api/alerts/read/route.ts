import { dbError, route } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Marks every alert in this workspace as read. */
export const POST = route(async ({ ws }) => {
  const { error } = await supabaseAdmin().from("alerts").update({ read_at: new Date().toISOString() }).eq("workspace_id", ws).is("read_at", null);
  if (error) throw dbError(error);
  return { ok: true };
});
