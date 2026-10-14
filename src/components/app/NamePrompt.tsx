"use client";

import { useState, type FormEvent } from "react";
import { mutate } from "swr";
import { useToast } from "@/components/shell/Toast";
import { Button, Modal } from "@/components/ui";
import { refreshAll } from "@/lib/client/api";
import { useWorkspace } from "@/lib/client/hooks";

/**
 * First-visit popup. The app shows empty screens behind it until the visitor
 * picks a unique name, which creates their private space.
 */
export function NamePrompt() {
  const { workspace, loading } = useWorkspace();
  return (
    <Modal open={!loading && workspace === null} onClose={() => {}} labelledBy="name-title" locked>
      <NameForm />
    </Modal>
  );
}

function NameForm() {
  const say = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) return setError("Names need at least 2 characters.");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not save your name. Try again.");
      await mutate("/api/workspace", body, { revalidate: false });
      await refreshAll();
      say(`Welcome, ${body.workspace.name}. Your space is ready.`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="dlg" noValidate onSubmit={submit} style={{ width: "min(420px, calc(100vw - 32px))" }}>
      <div className="dlg-head">
        <h2 id="name-title">Welcome to Yaad</h2>
      </div>
      <div className="dlg-body">
        <p style={{ margin: 0, color: "var(--ink-2)" }}>
          What should we call you? Your name creates your own space for family, reminders and calls. Each name can be used once.
        </p>
        <div className="field">
          <label htmlFor="ws-name">Your name</label>
          <input
            id="ws-name"
            className="input"
            maxLength={40}
            placeholder="Pavan"
            autoComplete="given-name"
            autoFocus
            value={name}
            aria-invalid={error !== null}
            aria-describedby={error ? "ws-name-err" : undefined}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>
        {error ? (
          <p className="err" id="ws-name-err" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mono" style={{ margin: 0, textTransform: "none", letterSpacing: 0 }}>
          This browser remembers your space with a cookie. Family members also show up under this name as the person who set the reminder.
        </p>
      </div>
      <div className="dlg-foot">
        <Button type="submit" disabled={saving}>
          {saving ? "Creating your space…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
