import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { ApiError } from "./api-error";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./auth/password";
import { supabaseAdmin } from "./supabase-admin";

// A workspace is an account: a unique username (case-insensitive) and a
// password. Each logged-in device holds a random session token in the httpOnly
// cookie "yaad_session"; only its SHA-256 is stored in the sessions table.
//
// Accounts created before passwords existed are reached through the old
// "yaad_ws" cookie (the workspace id) until their owner sets a password.

const SESSION_COOKIE = "yaad_session";
const LEGACY_COOKIE = "yaad_ws";
const ONE_YEAR_S = 60 * 60 * 24 * 365;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const NAME_TAKEN = "This username is already taken. Choose another one.";
export const NEED_NAME = "Log in or create an account to get started.";
export const BAD_LOGIN = "Wrong username or password.";
export const NO_PASSWORD_YET =
  "This account has no password yet. Open Yaad on the device where you created it and set a password in Settings.";

export type Workspace = { id: string; name: string; hasPassword: boolean };

const db = () => supabaseAdmin();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: ONE_YEAR_S,
  path: "/",
};

async function startSession(workspaceId: string) {
  const token = randomBytes(32).toString("base64url");
  const { error } = await db()
    .from("sessions")
    .insert({ workspace_id: workspaceId, token_hash: sha256(token), expires_at: new Date(Date.now() + ONE_YEAR_S * 1000).toISOString() });
  if (error) throw new ApiError(500, "Could not log you in. Try again.");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOpts);
  jar.delete(LEGACY_COOKIE);
}

type Row = { id: string; name: string | null; password_hash: string | null; last_seen_at: string };

function toWorkspace(r: Row): Workspace | null {
  return r.name ? { id: r.id, name: r.name, hasPassword: Boolean(r.password_hash) } : null;
}

async function touch(r: Row) {
  if (Date.now() - new Date(r.last_seen_at).getTime() > TOUCH_EVERY_MS) {
    await db().from("workspaces").update({ last_seen_at: new Date().toISOString() }).eq("id", r.id);
  }
}

/** This browser's account, or null when it is not logged in. */
export async function currentWorkspace(): Promise<Workspace | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const { data } = await db()
      .from("sessions")
      .select("id, expires_at, workspaces(id, name, password_hash, last_seen_at)")
      .eq("token_hash", sha256(token))
      .maybeSingle();
    const ws = data?.workspaces as unknown as Row | null;
    if (data && ws && new Date(data.expires_at).getTime() > Date.now()) {
      await touch(ws);
      return toWorkspace(ws);
    }
  }

  // Older browsers: the workspace id itself, only while the account has no password.
  const legacy = jar.get(LEGACY_COOKIE)?.value;
  if (legacy && UUID.test(legacy)) {
    const { data } = await db().from("workspaces").select("id, name, password_hash, last_seen_at").eq("id", legacy).maybeSingle();
    if (data && !data.password_hash) {
      await touch(data as Row);
      return toWorkspace(data as Row);
    }
  }
  return null;
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
 * Creates an account and logs this browser in. If the old cookie points at an
 * unnamed workspace (from before names existed), that one is used, so its
 * data is kept.
 */
export async function createAccount(rawName: string, password: string): Promise<Workspace> {
  const name = cleanName(rawName);
  const password_hash = await hashPassword(password);
  const legacy = (await cookies()).get(LEGACY_COOKIE)?.value;

  if (legacy && UUID.test(legacy)) {
    const { data: row } = await db().from("workspaces").select("id, name").eq("id", legacy).maybeSingle();
    if (row && !row.name) {
      const { error } = await db().from("workspaces").update({ name, password_hash }).eq("id", row.id);
      if (error) throw error.code === "23505" ? new ApiError(409, NAME_TAKEN) : new ApiError(500, "Could not create your account. Try again.");
      await startSession(row.id);
      return { id: row.id, name, hasPassword: true };
    }
  }

  const { data: ws, error } = await db().from("workspaces").insert({ name, password_hash }).select("id").single();
  if (error || !ws) throw error?.code === "23505" ? new ApiError(409, NAME_TAKEN) : new ApiError(500, "Could not create your account. Try again.");
  const { error: settingsError } = await db().from("settings").insert({ workspace_id: ws.id });
  if (settingsError) throw new ApiError(500, "Could not create your settings. Try again.");
  await startSession(ws.id);
  return { id: ws.id, name, hasPassword: true };
}

/** Logs this browser in to an existing account. */
export async function login(rawName: string, password: string): Promise<Workspace> {
  const name = cleanName(rawName);
  const { data } = await db().from("workspaces").select("id, name, password_hash").ilike("name", name.replace(/[\\%_]/g, "\\$&")).maybeSingle();
  if (data && !data.password_hash) {
    // Spend the same time as a real check before saying so.
    await verifyPassword(password, DUMMY_HASH);
    throw new ApiError(403, NO_PASSWORD_YET);
  }
  const ok = await verifyPassword(password, data?.password_hash ?? DUMMY_HASH);
  if (!data || !ok) throw new ApiError(401, BAD_LOGIN);
  await startSession(data.id);
  return { id: data.id, name: data.name, hasPassword: true };
}

/** Ends this device's session. Other devices stay logged in. */
export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().from("sessions").delete().eq("token_hash", sha256(token));
  jar.delete(SESSION_COOKIE);
  jar.delete(LEGACY_COOKIE);
}

/**
 * Sets or changes the password. Changing needs the current one. Every other
 * device is logged out; this one gets a fresh session.
 */
export async function setPassword(ws: Workspace, current: string | undefined, next: string) {
  const { data } = await db().from("workspaces").select("password_hash").eq("id", ws.id).single();
  if (data?.password_hash && !(await verifyPassword(current ?? "", data.password_hash))) {
    throw new ApiError(401, "Your current password is not right.");
  }
  const { error } = await db().from("workspaces").update({ password_hash: await hashPassword(next) }).eq("id", ws.id);
  if (error) throw new ApiError(500, "Could not save your password. Try again.");
  await db().from("sessions").delete().eq("workspace_id", ws.id);
  await startSession(ws.id);
  return { ...ws, hasPassword: true };
}

export async function renameWorkspace(ws: Workspace, rawName: string): Promise<Workspace> {
  const name = cleanName(rawName);
  const { error } = await db().from("workspaces").update({ name }).eq("id", ws.id);
  if (error) throw error.code === "23505" ? new ApiError(409, NAME_TAKEN) : new ApiError(500, "Could not save your name. Try again.");
  return { ...ws, name };
}
