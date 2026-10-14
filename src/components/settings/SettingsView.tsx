"use client";

import { useState, type ReactNode } from "react";
import { Loading } from "@/components/app/Loading";
import { LoadError } from "@/components/dashboard/DashboardView";
import { useToast } from "@/components/shell/Toast";
import { Button, Card, Toggle } from "@/components/ui";
import { api } from "@/lib/client/api";
import { setOwnerName, useFamily, useOwnerName, useSettings } from "@/lib/client/hooks";
import type { Settings } from "@/lib/types";
import { LANGUAGES } from "@/lib/voices";

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
      <Card className="set-card">
        <Row title="Retry after" desc="If nobody answers, or they say later, the agent calls again after this long.">
          <select className="input" aria-label="Retry after" value={s.retryMin} onChange={(e) => save({ retryMin: Number(e.target.value) as Settings["retryMin"] })}>
            {[5, 10, 15].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
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
          </select>
        </Row>
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
        <Row title="Your name" desc="Used in the greeting on this device.">
          <input
            className="input"
            aria-label="Your name"
            maxLength={30}
            defaultValue={owner}
            key={`name-${owner}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== owner) {
                setOwnerName(v);
                say("Name saved.");
              }
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
