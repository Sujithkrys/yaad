"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { formatTime } from "@/lib/format";
import { calls as sampleCalls, INITIAL_SELECTED_CALL, people, RETRY_AFTER_MIN, type Call } from "@/lib/sample-data";
import { CallRow } from "./CallRow";

const SLOTS = 32; // half-hour slots from 6 AM to 10 PM
const FILTER_OPTIONS = [{ value: "all", label: "All family" }, ...people.map((p) => ({ value: p.name, label: p.name }))];

function slotOf(c: Call) {
  return (c.h - 6) * 2 + (c.m >= 30 ? 1 : 0);
}

export function TodaysCallsPanel() {
  const [calls, setCalls] = useState<Call[]>(sampleCalls);
  const [selected, setSelected] = useState(INITIAL_SELECTED_CALL);
  const [filter, setFilter] = useState("all");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finishCall = useCallback((id: number) => {
    setCalls((prev) =>
      prev.map((c) => (c.id === id && c.status === "calling" ? { ...c, status: "confirmed", note: formatTime(19, 3) } : c)),
    );
  }, []);

  useEffect(() => {
    const list = timers.current;
    list.push(setTimeout(() => finishCall(INITIAL_SELECTED_CALL), 9000));
    return () => list.forEach(clearTimeout);
  }, [finishCall]);

  const visible = calls.filter((c) => filter === "all" || c.who === filter);
  const confirmed = calls.filter((c) => c.status === "confirmed").length;
  const sel = calls.find((c) => c.id === selected);

  const ticks: Tick[] = Array.from({ length: SLOTS }, (_, i) => {
    const hit = calls.find((c) => slotOf(c) === i);
    if (!hit) return {};
    const shown = filter === "all" || hit.who === filter;
    return { status: hit.status, filled: true, selected: shown && hit.id === selected, dim: !shown };
  });

  function onFilter(value: string) {
    setFilter(value);
    const first = calls.find((c) => value === "all" || c.who === value);
    setSelected(first ? first.id : 0);
  }

  function callNow() {
    if (!sel || sel.status === "confirmed" || sel.status === "calling") return;
    setCalls((prev) => prev.map((c) => (c.id === sel.id ? { ...c, status: "calling", note: "ringing" } : c)));
    timers.current.push(setTimeout(() => finishCall(sel.id), 3500));
  }

  let cta: React.ReactNode = "Pick a call";
  if (sel?.status === "confirmed") cta = "Confirmed";
  else if (sel?.status === "calling") cta = `Calling ${sel.who}…`;
  else if (sel)
    cta = (
      <>
        <CallNowIcon />
        Call {sel.who} now
      </>
    );

  return (
    <Panel aria-labelledby="a-title">
      <PanelHead>
        <PanelTitle
          id="a-title"
          info="Each reminder places one phone call. If nobody answers, the agent retries after 10 minutes."
        >
          Today&apos;s calls
        </PanelTitle>
        <ChipSelect label="Show calls for" value={filter} options={FILTER_OPTIONS} onChange={onFilter} icon={<PersonIcon />} />
      </PanelHead>

      <Card className="hero">
        <MonoLabel>Confirmed today</MonoLabel>
        <div className="hero-row">
          <div className="big num">
            {confirmed}
            <small>/ {calls.length}</small>
          </div>
          <MonoLabel style={{ textAlign: "right" }}>
            Retry after <b>{RETRY_AFTER_MIN} min</b>
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

      <Card className="rows">
        {visible.length ? (
          visible.map((c) => <CallRow key={c.id} call={c} selected={c.id === selected} onSelect={setSelected} />)
        ) : (
          <p className="empty-rows">No calls today for this person.</p>
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
        <Button onClick={callNow} disabled={!sel || sel.status === "confirmed" || sel.status === "calling"}>
          {cta}
        </Button>
      </PanelFoot>
    </Panel>
  );
}
