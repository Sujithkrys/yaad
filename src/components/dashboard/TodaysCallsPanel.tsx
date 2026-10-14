"use client";

import { useState } from "react";
import {
  Button,
  CallNowIcon,
  Card,
  ChipSelect,
  KebabIcon,
  MonoLabel,
  Panel,
  PanelFoot,
  PanelHead,
  PanelTitle,
  PersonIcon,
  TickBar,
  type Tick,
} from "@/components/ui";
import { callNow } from "@/lib/app/store";
import type { CallRecord } from "@/lib/app/types";
import { CallRow } from "./CallRow";

const SLOTS = 32; // half-hour slots from 6 AM to 10 PM

function slotOf(c: CallRecord) {
  const d = new Date(c.scheduledTs);
  return (d.getHours() - 6) * 2 + (d.getMinutes() >= 30 ? 1 : 0);
}

function defaultSelection(calls: CallRecord[]) {
  const order = ["calling", "retry", "scheduled", "missed", "confirmed"] as const;
  for (const s of order) {
    const hit = calls.find((c) => c.status === s);
    if (hit) return hit.id;
  }
  return null;
}

export function TodaysCallsPanel({ calls, retryMin }: { calls: CallRecord[]; retryMin: number }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const visible = calls.filter((c) => filter === "all" || c.person.name === filter);
  const selected = picked && visible.some((c) => c.id === picked) ? picked : defaultSelection(visible);
  const sel = calls.find((c) => c.id === selected);
  const confirmed = calls.filter((c) => c.status === "confirmed").length;
  const names = [...new Set(calls.map((c) => c.person.name))];
  const options = [{ value: "all", label: "All family" }, ...names.map((n) => ({ value: n, label: n }))];

  const ticks: Tick[] = Array.from({ length: SLOTS }, (_, i) => {
    const hits = calls.filter((c) => slotOf(c) === i);
    const hit = hits.find((c) => filter === "all" || c.person.name === filter) ?? hits[0];
    if (!hit) return {};
    const shown = filter === "all" || hit.person.name === filter;
    return { status: hit.status, filled: true, selected: shown && hit.id === selected, dim: !shown };
  });

  const busy = !sel || sel.status === "confirmed" || sel.status === "calling";
  let cta: React.ReactNode = "Pick a call";
  if (sel?.status === "confirmed") cta = "Confirmed";
  else if (sel?.status === "calling") cta = `Calling ${sel.person.name}…`;
  else if (sel)
    cta = (
      <>
        <CallNowIcon />
        Call {sel.person.name} now
      </>
    );

  return (
    <Panel aria-labelledby="a-title">
      <PanelHead>
        <PanelTitle
          id="a-title"
          info={`Each reminder places one phone call. If nobody answers, the agent retries after ${retryMin} minutes.`}
        >
          Today&apos;s calls
        </PanelTitle>
        <ChipSelect label="Show calls for" value={filter} options={options} onChange={setFilter} icon={<PersonIcon />} />
      </PanelHead>

      <Card className="hero">
        <MonoLabel>Confirmed today</MonoLabel>
        <div className="hero-row">
          <div className="big num">
            {confirmed}
            <small>/ {calls.length}</small>
          </div>
          <MonoLabel style={{ textAlign: "right" }}>
            Retry after <b>{retryMin} min</b>
          </MonoLabel>
        </div>
        <TickBar ticks={ticks} />
        <div className="axis mono" aria-hidden="true">
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>10 PM</span>
        </div>
      </Card>

      <Card className="rows fill">
        {visible.length ? (
          visible.map((c) => <CallRow key={c.id} call={c} selected={c.id === selected} onSelect={setPicked} />)
        ) : (
          <p className="empty-rows">{calls.length ? "No calls today for this person." : "No calls planned for today."}</p>
        )}
      </Card>

      <PanelFoot>
        <div className="foot-left">
          <span className="kebab" aria-hidden="true">
            <KebabIcon />
          </span>
          <MonoLabel as="span" className="live">
            <i className="dot" aria-hidden="true" />
            <span>Live · {calls.length} calls</span>
          </MonoLabel>
        </div>
        <Button onClick={() => sel && !busy && callNow(sel.id)} disabled={busy}>
          {cta}
        </Button>
      </PanelFoot>
    </Panel>
  );
}
