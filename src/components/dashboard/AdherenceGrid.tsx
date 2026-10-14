"use client";

import { useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { Card, MonoLabel, SegmentedControl, cx } from "@/components/ui";
import type { AdherenceRow } from "@/lib/app/calls";
import { fmtDate, fmtShortDate } from "@/lib/app/time";
import type { DayResult, ReminderKind } from "@/lib/app/types";

const KIND_OPTIONS: { value: ReminderKind; label: string }[] = [
  { value: "tablet", label: "Tablet" },
  { value: "walk", label: "Walk" },
  { value: "visit", label: "Visit" },
];

function cellClass(v: DayResult) {
  return v === 2 ? "l2" : v === 1 ? "l1" : v === 0 ? "l0" : "lp";
}

function cellLabel(v: DayResult) {
  return v === 2 ? "taken on first ring" : v === 1 ? "taken after retry" : v === 0 ? "missed" : v === -1 ? "not yet" : "no reminder";
}

function tipText(v: DayResult, alerts: boolean) {
  if (v === 2) return "Taken on the first ring";
  if (v === 1) return "Taken after one retry";
  if (v === 0) return alerts ? "Missed twice · family alerted" : "Missed twice";
  if (v === -1) return "Call not finished yet";
  return "No reminder of this type that day";
}

type Tip = { title: string; body: string; cell: HTMLElement } | null;

type AdherenceGridProps = {
  rows: AdherenceRow[];
  dayStarts: number[];
  kind: ReminderKind;
  missed: number;
  alerts: boolean;
  onKindChange: (k: ReminderKind) => void;
};

export function AdherenceGrid({ rows, dayStarts, kind, missed, alerts, onKindChange }: AdherenceGridProps) {
  const days = dayStarts.length;
  const axis = [dayStarts[0], dayStarts[Math.floor(days / 2)], dayStarts[days - 1]];
  const cardRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);

  function show(cell: HTMLElement) {
    const person = cell.dataset.p ?? "";
    const day = Number(cell.dataset.d);
    const v = Number(cell.dataset.v) as DayResult;
    setTip({ title: `${person} · ${fmtDate(dayStarts[day])}`, body: tipText(v, alerts), cell });
  }

  // Position after the content renders so the measured size is correct.
  useLayoutEffect(() => {
    const card = cardRef.current;
    const tipEl = tipRef.current;
    if (!tip || !card || !tipEl) return;
    const cr = card.getBoundingClientRect();
    const r = tip.cell.getBoundingClientRect();
    let left = r.left - cr.left + r.width / 2 - tipEl.offsetWidth / 2;
    left = Math.max(10, Math.min(left, cr.width - tipEl.offsetWidth - 10));
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${r.top - cr.top - tipEl.offsetHeight - 8}px`;
  }, [tip]);

  function onOver(e: MouseEvent | FocusEvent) {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".cell");
    if (cell) show(cell);
  }

  function onOut(e: MouseEvent | FocusEvent) {
    if ((e.target as HTMLElement).closest(".cell")) setTip(null);
  }

  return (
    <Card className="grid-card fill" ref={cardRef} onMouseOver={onOver} onFocus={onOver} onMouseOut={onOut} onBlur={onOut}>
      <div className="grid-top">
        <div>
          <h3>Family · {rows.length}</h3>
          <MonoLabel>
            {days} days · {missed} missed
          </MonoLabel>
        </div>
        <SegmentedControl label="Reminder type" options={KIND_OPTIONS} value={kind} onChange={onKindChange} />
      </div>

      <div className="hm">
        {rows.map(({ person: p, cells, pct }) => (
          <div className="hm-row" key={p.id}>
            <span className="hm-name">{p.name}</span>
            <div className="hm-cells">
              {cells.map((v, d) => (
                <button
                  key={d}
                  type="button"
                  className={cx("cell", cellClass(v), d === days - 1 && "today")}
                  data-p={p.name}
                  data-d={d}
                  data-v={v}
                  aria-label={`${p.name}, ${fmtDate(dayStarts[d])}, ${cellLabel(v)}`}
                />
              ))}
            </div>
            <span className="hm-pct num">{pct === null ? "–" : `${pct}%`}</span>
          </div>
        ))}
        {rows.length === 0 ? <p className="empty-rows">Nobody has agreed to calls yet.</p> : null}
      </div>

      <div className="hm-axis mono" aria-hidden="true">
        <span />
        <div>
          {axis.map((ts) => (
            <span key={ts}>{fmtShortDate(ts)}</span>
          ))}
        </div>
        <span />
      </div>

      <div className="legend mono">
        <span>
          <i style={{ background: "var(--blue)" }} />
          First ring
        </span>
        <span>
          <i style={{ background: "color-mix(in srgb, var(--blue) 42%, var(--card))" }} />
          Retry
        </span>
        <span>
          <i
            style={{
              background: "repeating-linear-gradient(135deg,var(--ink-3) 0 1px,transparent 1px 4px)",
              boxShadow: "inset 0 0 0 1px var(--line)",
            }}
          />
          Missed
        </span>
        <span>
          <i style={{ boxShadow: "inset 0 0 0 1px var(--line)" }} />
          Pending
        </span>
      </div>

      <div
        ref={tipRef}
        className={cx("tip", tip && "on")}
        role="status"
      >
        {tip ? (
          <>
            <b>{tip.title}</b>
            <span>{tip.body}</span>
          </>
        ) : null}
      </div>
    </Card>
  );
}
