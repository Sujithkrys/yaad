"use client";

import { useState } from "react";
import { useToast } from "@/components/shell/Toast";
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
import { api } from "@/lib/client/api";
import { istParts } from "@/lib/time";
import type { TodayItem } from "@/lib/types";
import { CallRow } from "./CallRow";

const SLOTS = 32; // half-hour slots from 6 AM to 10 PM

function slotOf(item: TodayItem) {
  const p = istParts(item.scheduledAt);
  return (p.hour - 6) * 2 + (p.minute >= 30 ? 1 : 0);
}

function defaultSelection(items: TodayItem[]) {
  for (const s of ["calling", "retry", "scheduled", "missed", "confirmed"] as const) {
    const hit = items.find((c) => c.status === s);
    if (hit) return hit.key;
  }
  return null;
}

export function TodaysCallsPanel({ items, retryMin }: { items: TodayItem[]; retryMin: number }) {
  const say = useToast();
  const [picked, setPicked] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  const visible = items.filter((c) => filter === "all" || c.personName === filter);
  const selected = picked && visible.some((c) => c.key === picked) ? picked : defaultSelection(visible);
  const sel = items.find((c) => c.key === selected);
  const confirmed = items.filter((c) => c.status === "confirmed").length;
  const names = [...new Set(items.map((c) => c.personName))];
  const options = [{ value: "all", label: "All family" }, ...names.map((n) => ({ value: n, label: n }))];

  const ticks: Tick[] = Array.from({ length: SLOTS }, (_, i) => {
    const hits = items.filter((c) => slotOf(c) === i);
    const hit = hits.find((c) => filter === "all" || c.personName === filter) ?? hits[0];
    if (!hit) return {};
    const shown = filter === "all" || hit.personName === filter;
    return { status: hit.status, filled: true, selected: shown && hit.key === selected, dim: !shown };
  });

  const disabled = busy || !sel || sel.status === "confirmed" || sel.status === "calling";
  let cta: React.ReactNode = "Pick a call";
  if (sel?.status === "confirmed") cta = "Confirmed";
  else if (sel?.status === "calling") cta = `Calling ${sel.personName}…`;
  else if (sel)
    cta = (
      <>
        <CallNowIcon />
        Call {sel.personName} now
      </>
    );

  async function callNow() {
    if (!sel) return;
    setBusy(true);
    try {
      await api.callNow(sel.reminderId);
      say(`Calling ${sel.personName} now.`);
    } catch (e) {
      say((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
            <small>/ {items.length}</small>
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
          visible.map((c) => <CallRow key={c.key} item={c} selected={c.key === selected} onSelect={setPicked} />)
        ) : (
          <p className="empty-rows">{items.length ? "No calls today for this person." : "No calls planned for today."}</p>
        )}
      </Card>

      <PanelFoot>
        <div className="foot-left">
          <span className="kebab" aria-hidden="true">
            <KebabIcon />
          </span>
          <MonoLabel as="span" className="live">
            <i className="dot" aria-hidden="true" />
            <span>Live · {items.length} calls</span>
          </MonoLabel>
        </div>
        <Button onClick={callNow} disabled={disabled}>
          {cta}
        </Button>
      </PanelFoot>
    </Panel>
  );
}
