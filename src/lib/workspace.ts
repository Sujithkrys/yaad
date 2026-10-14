import "server-only";

import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase-admin";

const COOKIE = "yaad_ws";
const ONE_YEAR = 60 * 60 * 24 * 365;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The visitor's workspace id from the httpOnly cookie. Creates a workspace
 * (and its default settings row) when the cookie is missing or stale.
 * Call only from route handlers, where cookies can be set.
 */
export async function getWorkspaceId(): Promise<string> {
  const db = supabaseAdmin();
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;

  if (existing && UUID.test(existing)) {
    const { data } = await db.from("workspaces").select("id, last_seen_at").eq("id", existing).maybeSingle();
    if (data) {
      if (Date.now() - new Date(data.last_seen_at).getTime() > TOUCH_EVERY_MS) {
        await db.from("workspaces").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
      }
      return data.id;
    }
  }

  const { data: ws, error } = await db.from("workspaces").insert({}).select("id").single();
  if (error || !ws) throw new Error("Could not create a workspace.");
  const { error: settingsError } = await db.from("settings").insert({ workspace_id: ws.id });
  if (settingsError) throw new Error("Could not create workspace settings.");

  jar.set(COOKIE, ws.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return ws.id;
}
