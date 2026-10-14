import "server-only";

import { cookies } from "next/headers";
import { ApiError } from "./api-error";
import { supabaseAdmin } from "./supabase-admin";

// A workspace is a visitor's private space, named on first visit. The name is
// unique (case-insensitive). The httpOnly cookie "yaad_ws" remembers which
// workspace this browser owns; there is no password yet.

const COOKIE = "yaad_ws";
const ONE_YEAR = 60 * 60 * 24 * 365;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const NAME_TAKEN = "That name is already reserved. Try another name.";
export const NEED_NAME = "Choose a name to get started.";

export type Workspace = { id: string; name: string };

async function cookieId() {
  const v = (await cookies()).get(COOKIE)?.value;
  return v && UUID.test(v) ? v : null;
}

/** This browser's workspace, or null when there is none yet or it has no name. */
export async function currentWorkspace(): Promise<Workspace | null> {
  const id = await cookieId();
  if (!id) return null;
  const db = supabaseAdmin();
  const { data } = await db.from("workspaces").select("id, name, last_seen_at").eq("id", id).maybeSingle();
  if (!data?.name) return null;
  if (Date.now() - new Date(data.last_seen_at).getTime() > TOUCH_EVERY_MS) {
    await db.from("workspaces").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  }
  return { id: data.id, name: data.name };
}

export async function requireWorkspace(): Promise<Workspace> {
  const ws = await currentWorkspace();
  if (!ws) throw new ApiError(401, NEED_NAME);
  return ws;
}

export function cleanName(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Creates a named workspace for this browser. If the cookie already points at
 * an unnamed workspace (from before names existed), it is named instead, so
 * its data is kept.
 */
export async function claimWorkspace(rawName: string): Promise<Workspace> {
  const name = cleanName(rawName);
  const db = supabaseAdmin();
  const jar = await cookies();
  const existingId = await cookieId();

  if (existingId) {
    const { data: row } = await db.from("workspaces").select("id, name").eq("id", existingId).maybeSingle();
    if (row?.name) return { id: row.id, name: row.name };
    if (row) {
      const { error } = await db.from("workspaces").update({ name }).eq("id", row.id);
      if (error) throw error.code === "23505" ? new ApiError(409, NAME_TAKEN) : new ApiError(500, "Could not save your name. Try again.");
      return { id: row.id, name };
    }
  }

  const { data: ws, error } = await db.from("workspaces").insert({ name }).select("id, name").single();
  if (error || !ws) throw error?.code === "23505" ? new ApiError(409, NAME_TAKEN) : new ApiError(500, "Could not create your space. Try again.");
  const { error: settingsError } = await db.from("settings").insert({ workspace_id: ws.id });
  if (settingsError) throw new ApiError(500, "Could not create your settings. Try again.");

  jar.set(COOKIE, ws.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return { id: ws.id, name: ws.name };
}

export async function renameWorkspace(id: string, rawName: string): Promise<Workspace> {
  const name = cleanName(rawName);
  const { error } = await supabaseAdmin().from("workspaces").update({ name }).eq("id", id);
  if (error) throw error.code === "23505" ? new ApiError(409, NAME_TAKEN) : new ApiError(500, "Could not save your name. Try again.");
  return { id, name };
}
