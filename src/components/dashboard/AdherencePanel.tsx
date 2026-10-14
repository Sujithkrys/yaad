"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/shell/Toast";
import { Button, Card, KebabIcon, MonoLabel, Panel, PanelFoot, PanelHead, PanelTitle, StatBar } from "@/components/ui";
import { ADHERENCE_DAYS, adherence } from "@/lib/app/calls";
import { fmtTs } from "@/lib/app/time";
import type { AppState, ReminderKind } from "@/lib/app/types";
import { AdherenceGrid } from "./AdherenceGrid";
import { Sparkline } from "./Sparkline";

export function AdherencePanel({ state, now }: { state: AppState; now: number }) {
  const [kind, setKind] = useState<ReminderKind>("tablet");
  const [sent, setSent] = useState(false);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const say = useToast();
  const s = adherence(state, kind, now);
  const alerts = state.settings.alertFamily;

  useEffect(() => () => clearTimeout(sentTimer.current), []);

  const p1 = s.total ? Math.round((s.first / s.total) * 100) : 0;
  const p2 = s.total ? Math.round((s.retried / s.total) * 100) : 0;
  const delta = Math.round(s.delta * 10) / 10;

  function sendSummary() {
    setSent(true);
    say(`Weekly summary sent to ${state.user.name}.`);
    clearTimeout(sentTimer.current);
    sentTimer.current = setTimeout(() => setSent(false), 2200);
  }

  return (
    <Panel aria-labelledby="b-title">
      <PanelHead>
        <PanelTitle id="b-title" info="A day counts as taken when the person says yes on the first call or after a retry.">
          Adherence
        </PanelTitle>
        <MonoLabel as="span">Last {ADHERENCE_DAYS} days</MonoLabel>
      </PanelHead>

      <Card className="hero-b">
        <MonoLabel>Reminders taken</MonoLabel>
        <div className="hero-row" style={{ marginTop: 8 }}>
          <div className="big num">
            {s.total ? s.pct : "–"}
            <small style={{ marginLeft: 2, fontSize: 20 }}>%</small>
            {s.total ? (
              <span
                className="delta"
                style={delta < 0 ? { background: "var(--bad-bg)", color: "var(--bad)" } : undefined}
              >
                <span aria-hidden="true">{delta < 0 ? "▼" : "▲"}</span>
                <span className="sr-only">{delta < 0 ? "Down" : "Up"}</span> {Math.abs(delta).toFixed(1)}%
              </span>
            ) : null}
          </div>
          <Sparkline values={s.perDay} />
        </div>
        <MonoLabel style={{ marginTop: 10 }}>
          vs previous {ADHERENCE_DAYS} days · {s.rows.length} people
        </MonoLabel>
        <div className="stats3">
          <div className="stat">
            <MonoLabel>First ring</MonoLabel>
            <div className="v num">
              {p1}
              <small>%</small>
            </div>
            <StatBar on={Math.round((p1 / 100) * 16)} />
          </div>
          <div className="stat">
            <MonoLabel>After retry</MonoLabel>
            <div className="v num">
              {p2}
              <small>%</small>
            </div>
            <StatBar on={Math.min(16, Math.round((p2 / 100) * 3 * 16))} />
          </div>
          <div className="stat">
            <MonoLabel>Family alerts</MonoLabel>
            <div className="v num">
              {alerts ? s.missed : 0}
              <small>sent</small>
            </div>
            <StatBar on={alerts ? Math.round(Math.min(1, s.missed / 8) * 16) : 0} />
          </div>
        </div>
      </Card>

      <AdherenceGrid
        rows={s.rows}
        dayStarts={s.dayStarts}
        kind={kind}
        missed={s.missed}
        alerts={alerts}
        onKindChange={setKind}
      />

      <PanelFoot>
        <div className="foot-left">
          <span className="kebab" aria-hidden="true">
            <KebabIcon />
          </span>
          <MonoLabel as="span" className="live">
            <i className="dot" aria-hidden="true" />
            Synced {fmtTs(now)}
          </MonoLabel>
        </div>
        <Button onClick={sendSummary} disabled={sent}>
          {sent ? "Summary sent" : "Send weekly summary"}
        </Button>
      </PanelFoot>
    </Panel>
  );
}
