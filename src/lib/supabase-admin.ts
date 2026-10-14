import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client with the secret (service role) key. Row level security
// has no policies, so this is the only way to reach the data. Never import
// this from a client component and never send the key to the browser.

let client: SupabaseClient | null = null;

export function supabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
