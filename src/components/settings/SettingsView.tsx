"use client";

import { useState, type ReactNode } from "react";
import { Loading } from "@/components/app/Loading";
import { useToast } from "@/components/shell/Toast";
import { Button, Card, Toggle } from "@/components/ui";
import { resetDemo, setUserName, updateSettings, useAppState } from "@/lib/app/store";

function Row({ title, desc, children, id }: { title: string; desc: string; children: ReactNode; id?: string }) {
  return (
    <div className="set-row">
      <div>
        <div className="t" id={id}>
          {title}
        </div>
        <div className="d">{desc}</div>
      </div>
      <div className="ctl">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const state = useAppState();
  const say = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!state) return <Loading />;
  const s = state.settings;

  return (
    <div className="view-stack" style={{ maxWidth: 720 }}>
      <h2 className="set-title">Calls</h2>
      <Card className="set-card">
        <Row title="Retry after" desc="If nobody answers, or they say later, the agent calls once more after this long.">
          <select
            className="input"
            aria-label="Retry after"
            value={s.retryMin}
            onChange={(e) => updateSettings({ retryMin: Number(e.target.value) })}
          >
            {[5, 10, 15, 30].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Row>
        <Row title="Quiet hours" desc="No calls are placed in this window. Reminders set inside it will not ring.">
          <Toggle checked={s.quietOn} label="Quiet hours" onChange={(on) => updateSettings({ quietOn: on })} />
        </Row>
        <Row title="Quiet from and to" desc="Applies every day.">
          <input
            className="input"
            style={{ width: 120 }}
            type="time"
            aria-label="Quiet hours start"
            disabled={!s.quietOn}
            value={s.quietFrom}
            onChange={(e) => e.target.value && updateSettings({ quietFrom: e.target.value })}
          />
          <input
            className="input"
            style={{ width: 120 }}
            type="time"
            aria-label="Quiet hours end"
            disabled={!s.quietOn}
            value={s.quietTo}
            onChange={(e) => e.target.value && updateSettings({ quietTo: e.target.value })}
          />
        </Row>
      </Card>

      <h2 className="set-title">Alerts</h2>
      <Card className="set-card">
        <Row title="Alert me when a call is missed" desc="After two unanswered calls, Yaad messages you so you can check in.">
          <Toggle checked={s.alertFamily} label="Alert me when a call is missed" onChange={(on) => updateSettings({ alertFamily: on })} />
        </Row>
        <Row title="Weekly summary" desc="Every Sunday evening, a short message with how the week went.">
          <Toggle checked={s.weeklySummary} label="Weekly summary" onChange={(on) => updateSettings({ weeklySummary: on })} />
        </Row>
      </Card>

      <h2 className="set-title">Account</h2>
      <Card className="set-card">
        <Row title="Your name" desc="Used in greetings and in the consent message to your family.">
          <input
            className="input"
            aria-label="Your name"
            maxLength={30}
            key={state.user.name}
            defaultValue={state.user.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== state.user.name) {
                setUserName(v);
                say("Name saved.");
              }
            }}
          />
        </Row>
        <Row title="Sample data" desc="Put back the sample family, reminders and settings. Your changes are lost.">
          {confirmReset ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
              <Button
                variant="bad"
                size="sm"
                onClick={() => {
                  resetDemo();
                  setConfirmReset(false);
                  say("Sample data restored.");
                }}
              >
                Reset
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
              Reset sample data
            </Button>
          )}
        </Row>
      </Card>
    </div>
  );
}
