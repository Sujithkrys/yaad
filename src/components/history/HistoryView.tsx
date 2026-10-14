"use client";

import { useState } from "react";
import { Loading } from "@/components/app/Loading";
import { useDialogs } from "@/components/app/DialogsProvider";
import { Card, EmptyState, MonoLabel, Pill, PhoneIcon } from "@/components/ui";
import { callHistory } from "@/lib/app/calls";
import { useAppState, useNow } from "@/lib/app/store";
import { fmtDate, fmtDuration, fmtTs } from "@/lib/app/time";
import type { CallStatus } from "@/lib/app/types";

const STATUSES: { value: "all" | CallStatus; label: string }[] = [
  { value: "all", label: "All results" },
  { value: "confirmed", label: "Confirmed" },
  { value: "missed", label: "Missed" },
  { value: "retry", label: "Retry" },
  { value: "calling", label: "Calling" },
];

export function HistoryView() {
  const state = useAppState();
  const now = useNow(15_000);
  const dialogs = useDialogs();
  const [query, setQuery] = useState("");
  const [who, setWho] = useState("all");
  const [status, setStatus] = useState<"all" | CallStatus>("all");
  if (!state) return <Loading />;

  const q = query.trim().toLowerCase();
  const calls = callHistory(state, now, 14).filter(
    (c) =>
      (who === "all" || String(c.person.id) === who) &&
      (status === "all" || c.status === status) &&
      (!q || c.person.name.toLowerCase().includes(q) || c.reminder.text.toLowerCase().includes(q)),
  );

  return (
    <div className="view-stack">
      <Card>
        <div className="filters">
          <input
            className="input grow"
            type="search"
            placeholder="Search by name or reminder"
            aria-label="Search calls"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="input" aria-label="Person" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">All family</option>
            {state.family.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="input" aria-label="Result" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="list">
        {calls.length ? (
          <>
            <div className="thead mono" aria-hidden="true">
              <span>When</span>
              <span>Person</span>
              <span>Reminder</span>
              <span>Result</span>
              <span>Talk</span>
              <span>Tries</span>
            </div>
            {calls.map((c) => (
              <button
                key={c.id}
                type="button"
                className="trow"
                onClick={() => dialogs.showCall(c)}
                aria-label={`${c.person.name}, ${c.reminder.text}, ${fmtDate(c.scheduledTs)} ${fmtTs(c.scheduledTs)}, ${c.status}. Open details`}
              >
                <MonoLabel as="span">
                  {fmtDate(c.scheduledTs)} · {fmtTs(c.scheduledTs)}
                </MonoLabel>
                <span style={{ fontWeight: 500 }}>{c.person.name}</span>
                <span className="h-m" style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.reminder.text}
                </span>
                <span>
                  <Pill variant={c.status} />
                </span>
                <MonoLabel as="span" className="h-m num">
                  {fmtDuration(c.durationSec)}
                </MonoLabel>
                <MonoLabel as="span" className="h-m num">
                  {c.attempts}
                </MonoLabel>
              </button>
            ))}
          </>
        ) : (
          <EmptyState
            small
            icon={<PhoneIcon />}
            title="No calls match"
            description="Try another person or result, or clear the search."
          />
        )}
      </Card>
    </div>
  );
}
