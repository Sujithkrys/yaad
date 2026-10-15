"use client";

import { useState, type FormEvent } from "react";
import { mutate } from "swr";
import { useToast } from "@/components/shell/Toast";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/lib/client/hooks";

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Something went wrong. Try again.");
  return json;
}

/** Set a password (accounts made before passwords existed) or change it. */
export function PasswordRow() {
  const { workspace } = useWorkspace();
  const say = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const has = workspace?.hasPassword ?? false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setError("Passwords need at least 8 characters.");
    if (next !== confirm) return setError("The two passwords do not match.");
    setSaving(true);
    setError(null);
    try {
      const body = await post("/api/workspace/password", { current: has ? current : undefined, password: next });
      await mutate("/api/workspace", body, { revalidate: false });
      say(has ? "Password changed. Other devices were logged out." : "Password set. You can now log in on any device.");
      setOpen(false);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="set-row" id="password" style={{ flexWrap: "wrap" }}>
      <div>
        <div className="t">Password</div>
        <div className="d">
          {has
            ? "Log in on another phone or computer with your username and this password."
            : "Not set yet. Set one to log in to this account from other devices."}
        </div>
      </div>
      {!open ? (
        <div className="ctl">
          <Button size="sm" variant={has ? "ghost" : "primary"} onClick={() => setOpen(true)}>
            {has ? "Change password" : "Set password"}
          </Button>
        </div>
      ) : (
        <form noValidate onSubmit={submit} style={{ display: "grid", gap: 10, width: "100%", maxWidth: 420 }}>
          {has ? (
            <input
              className="input"
              type="password"
              aria-label="Current password"
              placeholder="Current password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          ) : null}
          <input
            className="input"
            type="password"
            aria-label="New password"
            placeholder="New password, at least 8 characters"
            autoComplete="new-password"
            maxLength={72}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <input
            className="input"
            type="password"
            aria-label="Confirm new password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            maxLength={72}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error ? (
            <p className="err" role="alert">
              {error}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save password"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Logs this device out. The account and its data stay. */
export function LogoutRow() {
  const { workspace } = useWorkspace();
  const say = useToast();
  const [busy, setBusy] = useState(false);
  const has = workspace?.hasPassword ?? false;

  async function logout() {
    setBusy(true);
    try {
      await post("/api/workspace/logout");
      await mutate(() => true, undefined, { revalidate: true });
      say("Logged out.");
    } catch (err) {
      say((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="set-row">
      <div>
        <div className="t">Log out</div>
        <div className="d">
          {has
            ? "Log out of this device. Log back in with your username and password."
            : "Set a password first, or you will not be able to log back in to this account."}
        </div>
      </div>
      <div className="ctl">
        <Button size="sm" variant="ghost" disabled={busy || !has} onClick={logout}>
          {busy ? "Logging out…" : "Log out"}
        </Button>
      </div>
    </div>
  );
}
