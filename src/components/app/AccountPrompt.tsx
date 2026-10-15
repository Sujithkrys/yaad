"use client";

import { useEffect, useState, type FormEvent } from "react";
import { mutate } from "swr";
import { useToast } from "@/components/shell/Toast";
import { Button, Modal, SegmentedControl } from "@/components/ui";
import { refreshAll } from "@/lib/client/api";
import { useWorkspace } from "@/lib/client/hooks";

type Mode = "create" | "login";

/**
 * Shown until this browser is logged in. Create an account with a unique
 * username and a password, or log in to an existing one from any device.
 */
export function AccountPrompt() {
  const { workspace, loading } = useWorkspace();
  return (
    <Modal open={!loading && workspace === null} onClose={() => {}} labelledBy="acct-title" locked>
      <AccountForm />
    </Modal>
  );
}

function AccountForm() {
  const say = useToast();
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const creating = mode === "create";

  // showModal() focuses the first control (the tab switch); start in the username box instead.
  useEffect(() => {
    const t = setTimeout(() => document.getElementById("acct-name")?.focus(), 0);
    return () => clearTimeout(t);
  }, [mode]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setConfirm("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) return setError(creating ? "Usernames need at least 2 characters." : "Enter your username.");
    if (creating && password.length < 8) return setError("Passwords need at least 8 characters.");
    if (!creating && !password) return setError("Enter your password.");
    if (creating && password !== confirm) return setError("The two passwords do not match.");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(creating ? "/api/workspace" : "/api/workspace/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean, password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Something went wrong. Try again.");
      await mutate("/api/workspace", body, { revalidate: false });
      await refreshAll();
      say(creating ? `Welcome, ${body.workspace.name}. Your account is ready.` : `Welcome back, ${body.workspace.name}.`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="dlg" noValidate onSubmit={submit} style={{ width: "min(420px, calc(100vw - 32px))" }}>
      <div className="dlg-head">
        <h2 id="acct-title">{creating ? "Welcome to Yaad" : "Welcome back"}</h2>
      </div>
      <div className="dlg-body">
        <SegmentedControl
          className="wide"
          label="Account"
          value={mode}
          onChange={switchMode}
          options={[
            { value: "create", label: "New account" },
            { value: "login", label: "Existing account" },
          ]}
        />
        <p style={{ margin: 0, color: "var(--ink-2)" }}>
          {creating
            ? "Pick a username and a password. You can log in with them on any phone or computer."
            : "Log in with your username and password to see your family, reminders and calls."}
        </p>
        <div className="field">
          <label htmlFor="acct-name">Username</label>
          <input
            id="acct-name"
            className="input"
            maxLength={40}
            placeholder="Pavan"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            value={name}
            aria-invalid={error !== null && /username/i.test(error)}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="acct-pass">Password</label>
          <input
            id="acct-pass"
            className="input"
            type="password"
            maxLength={72}
            autoComplete={creating ? "new-password" : "current-password"}
            placeholder={creating ? "At least 8 characters" : ""}
            value={password}
            aria-invalid={error !== null && /password/i.test(error)}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>
        {creating ? (
          <div className="field">
            <label htmlFor="acct-confirm">Confirm password</label>
            <input
              id="acct-confirm"
              className="input"
              type="password"
              maxLength={72}
              autoComplete="new-password"
              value={confirm}
              aria-invalid={error !== null && /match/i.test(error)}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>
        ) : null}
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mono" style={{ margin: 0, textTransform: "none", letterSpacing: 0 }}>
          {creating
            ? "Each username can be used once. Family members hear this name as the person who set the reminder."
            : "This device stays logged in until you log out in Settings."}
        </p>
      </div>
      <div className="dlg-foot">
        <Button type="submit" disabled={saving}>
          {saving ? (creating ? "Creating…" : "Logging in…") : creating ? "Create account" : "Log in"}
        </Button>
      </div>
    </form>
  );
}
