"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, KebabIcon, MonoLabel, Panel, PanelFoot, PanelHead, PanelTitle, StatBar } from "@/components/ui";
import {
  ADHERENCE_DAYS,
  adherenceDelta,
  buildAdherence,
  lastSynced,
  people,
  reminderKindLabel,
  type ReminderKind,
} from "@/lib/sample-data";
import { AdherenceGrid } from "./AdherenceGrid";
import { Sparkline } from "./Sparkline";

function summarize(kind: ReminderKind) {
  const data = buildAdherence(kind);
  let total = 0;
  let first = 0;
  let retried = 0;
  let missed = 0;
  const perDay: number[] = [];
  for (let d = 0; d < ADHERENCE_DAYS; d++) {
    let ok = 0;
    let n = 0;
    for (const p of people) {
      const v = data[p.name][d];
      if (v >= 0) {
        n++;
        total++;
        if (v > 0) ok++;
        if (v === 2) first++;
        if (v === 1) retried++;
        if (v === 0) missed++;
      }
    }
    perDay.push(n ? ok / n : 1);
  }
  return { data, total, first, retried, missed, perDay };
}

export function AdherencePanel() {
  const [kind, setKind] = useState<ReminderKind>("tablet");
  const [sent, setSent] = useState(false);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const s = useMemo(() => summarize(kind), [kind]);

  useEffect(() => () => clearTimeout(sentTimer.current), []);

  const pct = Math.round(((s.first + s.retried) / s.total) * 100);
  const p1 = Math.round((s.first / s.total) * 100);
  const p2 = Math.round((s.retried / s.total) * 100);

  function sendSummary() {
    setSent(true);
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
            {pct}
            <small style={{ marginLeft: 2, fontSize: 20 }}>%</small>
            <span className="delta">
              <span aria-hidden="true">▲</span>
              <span className="sr-only">Up</span> {adherenceDelta}
            </span>
          </div>
          <Sparkline values={s.perDay} />
        </div>
        <MonoLabel style={{ marginTop: 10 }}>
          vs previous {ADHERENCE_DAYS} days · {people.length} people
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
            <StatBar on={Math.round((p2 / 100) * 3 * 16)} />
          </div>
          <div className="stat">
            <MonoLabel>Family alerts</MonoLabel>
            <div className="v num">
              {s.missed}
              <small>sent</small>
            </div>
            <StatBar on={Math.round(Math.min(1, s.missed / 8) * 16)} />
          </div>
        </div>
      </Card>

      <AdherenceGrid
        data={s.data}
        kind={kind}
        kindLabel={reminderKindLabel[kind]}
        missed={s.missed}
        onKindChange={setKind}
      />

      <PanelFoot>
        <div className="foot-left">
          <span className="kebab" aria-hidden="true">
            <KebabIcon />
          </span>
          <MonoLabel as="span" className="live">
            <i className="dot" aria-hidden="true" />
            Synced {lastSynced}
          </MonoLabel>
        </div>
        <Button onClick={sendSummary} disabled={sent}>
          {sent ? "Summary sent" : "Send weekly summary"}
        </Button>
      </PanelFoot>
    </Panel>
  );
}
