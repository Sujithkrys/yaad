"use client";

import { useState, type ReactNode } from "react";
import { Loading } from "@/components/app/Loading";
import { LoadError } from "@/components/dashboard/DashboardView";
import { useToast } from "@/components/shell/Toast";
import { Button, Card, Pill, Toggle } from "@/components/ui";
import { api } from "@/lib/client/api";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/client/api";
import { useFamily, useOwnerName, useSettings } from "@/lib/client/hooks";
import type { Settings } from "@/lib/types";
import { LANGUAGES } from "@/lib/voices";

function SchedulerChip({ seconds }: { seconds: number | null }) {
  if (seconds === null) return <Pill variant="missed">Not running</Pill>;
  const min = Math.max(0, Math.round(seconds / 60));
  const healthy = min <= 5;
  return <Pill variant={healthy ? "confirmed" : "retry"}>{`Last tick ${min < 1 ? "just now" : `${min}m ago`}`}</Pill>;
}

function Row({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div>
        <div className="t">{title}</div>
        <div className="d">{desc}</div>
      </div>
      <div className="ctl">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const settings = useSettings();
  const family = useFamily();
  const owner = useOwnerName();
  const say = useToast();
  const health = useSWR<{ mode: string; ready: boolean; allowlist: number }>("/api/health/sarvam", fetcher).data;
  const scheduler = useSWR<{ secondsSinceTick: number | null; counts: { scheduled: number; retry: number; calling: number } }>(
    "/api/health/scheduler",
    fetcher,
    { refreshInterval: 30_000 },
  ).data;
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  if (settings.error) return <LoadError message={settings.error.message} />;
  if (!settings.data) return <Loading />;
  const s = settings.data;
  const empty = family.data?.length === 0;

  async function save(patch: Partial<Settings>) {
    try {
      await api.saveSettings(patch);
      say("Settings saved.");
    } catch (e) {
      say((e as Error).message);
    }
  }

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      say(done);
    } catch (e) {
      say((e as Error).message);
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  }

  return (
    <div className="view-stack" style={{ maxWidth: 720 }}>
      <h2 className="set-title">Calls</h2>
      <p className="foot-note" style={{ margin: "-8px 4px 0" }}>Calls are placed only to numbers you add with the person&apos;s consent.</p>
      <Card className="set-card">
        <Row
          title="Phone calls"
          desc={
            !health
              ? "Checking the Sarvam connection."
              : health.mode === "live"
                ? health.ready
                  ? health.allowlist
                    ? `Real calls through Sarvam, only to ${health.allowlist} allowlisted number${health.allowlist === 1 ? "" : "s"}.`
                    : "Real calls through Sarvam."
                  : "Live mode is on, but some Sarvam settings are missing on the server."
                : "Simulated: no real phone rings. Results arrive after a few seconds so you can try the app."
          }
        >
          {health ? (
            <Pill variant={health.mode === "live" ? (health.ready ? "confirmed" : "missed") : "scheduled"}>
              {health.mode === "live" ? "Live" : "Simulated"}
            </Pill>
          ) : null}
        </Row>
        <Row title="Retry after" desc="If nobody answers, or they say later, the agent calls again after this long.">
          <select className="input" aria-label="Retry after" value={s.retryMin} onChange={(e) => save({ retryMin: Number(e.target.value) as Settings["retryMin"] })}>
            {[5, 10, 15].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Row>
        {health?.mode === "simulate" ? (
          <Row title="Demo call outcome" desc="How simulated calls answer while real calling is off.">
            <select className="input" aria-label="Demo call outcome" value={s.demoOutcome} onChange={(e) => save({ demoOutcome: e.target.value as Settings["demoOutcome"] })}>
              <option value="random">Random</option>
              <option value="taken">Always taken</option>
              <option value="noanswer">Never answers</option>
            </select>
          </Row>
        ) : null}
        <Row
          title="Scheduler"
          desc={
            scheduler
              ? `${scheduler.counts.scheduled} scheduled · ${scheduler.counts.retry} waiting to retry · ${scheduler.counts.calling} ringing`
              : "Places reminder calls on time and retries missed ones."
          }
        >
          {scheduler ? <SchedulerChip seconds={scheduler.secondsSinceTick} /> : null}
        </Row>
        <Row title="Calls per reminder" desc="The first call plus retries before it counts as missed.">
          <select className="input" aria-label="Calls per reminder" value={s.maxAttempts} onChange={(e) => save({ maxAttempts: Number(e.target.value) })}>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 call, no retry" : `${n} calls`}
              </option>
            ))}
          </select>
        </Row>
        <Row title="Default language" desc="Used for new family members.">
          <select className="input" aria-label="Default language" value={s.defaultLang} onChange={(e) => save({ defaultLang: e.target.value as Settings["defaultLang"] })}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Row>
        <Row title="Quiet hours" desc="No calls are placed in this window. Reminders set inside it will not ring.">
          <Toggle checked={s.quietOn} label="Quiet hours" onChange={(on) => save({ quietOn: on })} />
        </Row>
        <Row title="Quiet from and to" desc="India time, every day.">
          <input
            className="input"
            style={{ width: 120 }}
            type="time"
            aria-label="Quiet hours start"
            disabled={!s.quietOn}
            defaultValue={s.quietFrom}
            key={`from-${s.quietFrom}`}
            onBlur={(e) => e.target.value && e.target.value !== s.quietFrom && save({ quietFrom: e.target.value })}
          />
          <input
            className="input"
            style={{ width: 120 }}
            type="time"
            aria-label="Quiet hours end"
            disabled={!s.quietOn}
            defaultValue={s.quietTo}
            key={`to-${s.quietTo}`}
            onBlur={(e) => e.target.value && e.target.value !== s.quietTo && save({ quietTo: e.target.value })}
          />
        </Row>
      </Card>

      <h2 className="set-title">Alerts</h2>
      <Card className="set-card">
        <Row title="Alert me when a call is missed" desc="After the last unanswered call, Yaad messages you so you can check in.">
          <Toggle checked={s.alert} label="Alert me when a call is missed" onChange={(on) => save({ alert: on })} />
        </Row>
        <Row title="Send alerts by" desc="Where missed-call alerts go.">
          <select
            className="input"
            aria-label="Send alerts by"
            disabled={!s.alert}
            value={s.alertChannel}
            onChange={(e) => save({ alertChannel: e.target.value as Settings["alertChannel"] })}
          >
            <option>WhatsApp</option>
            <option>SMS</option>
            <option>Email</option>
          </select>
        </Row>
        {s.alertChannel === "Email" ? (
          <Row title="Alert email" desc="Where missed-call alerts are emailed.">
            <input
              className="input"
              style={{ width: 220 }}
              type="email"
              aria-label="Alert email"
              placeholder="you@example.com"
              disabled={!s.alert}
              defaultValue={s.alertEmail}
              key={`email-${s.alertEmail}`}
              onBlur={(e) => e.target.value.trim() !== s.alertEmail && save({ alertEmail: e.target.value.trim() })}
            />
          </Row>
        ) : null}
        <Row title="Alert number" desc="Your 10 digit mobile number.">
          <input
            className="input"
            aria-label="Alert number"
            inputMode="numeric"
            maxLength={11}
            placeholder="98765 43210"
            disabled={!s.alert}
            defaultValue={s.alertNumber}
            key={`num-${s.alertNumber}`}
            onBlur={(e) => e.target.value.replace(/\D/g, "") !== s.alertNumber && save({ alertNumber: e.target.value })}
          />
        </Row>
      </Card>

      <h2 className="set-title">Account</h2>
      <Card className="set-card">
        <Row title="Your name" desc="Names your space and tells your family who set the reminder. Each name can be used once.">
          <input
            className="input"
            aria-label="Your name"
            maxLength={30}
            defaultValue={owner}
            key={`name-${owner}`}
            onBlur={async (e) => {
              const v = e.target.value.trim();
              if (!v || v === owner) return;
              const res = await fetch("/api/workspace", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: v }),
              });
              const body = await res.json().catch(() => null);
              if (!res.ok) {
                say(body?.error ?? "Could not save your name.");
                e.target.value = owner;
                return;
              }
              await mutate("/api/workspace", body, { revalidate: false });
              say("Name saved.");
            }}
          />
        </Row>
        <Row
          title="Sample data"
          desc={empty ? "Load a sample family with reminders and four weeks of calls." : "Remove all people, reminders and calls. Settings are kept."}
        >
          {empty ? (
            <Button size="sm" disabled={busy} onClick={() => run(api.seed, "Sample data loaded.")}>
              {busy ? "Loading…" : "Load sample data"}
            </Button>
          ) : confirmReset ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
              <Button variant="bad" size="sm" disabled={busy} onClick={() => run(api.reset, "All people, reminders and calls removed.")}>
                Delete everything
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
              Clear data
            </Button>
          )}
        </Row>
      </Card>
    </div>
  );
}
