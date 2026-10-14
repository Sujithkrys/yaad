"use client";

import { useDeferredValue, useState } from "react";
import { Loading } from "@/components/app/Loading";
import { useDialogs } from "@/components/app/DialogsProvider";
import { LoadError } from "@/components/dashboard/DashboardView";
import { Card, EmptyState, MonoLabel, Pill, PhoneIcon } from "@/components/ui";
import { useCalls, useFamily } from "@/lib/client/hooks";
import { fmtDate, fmtDuration, fmtTs } from "@/lib/time";
import type { CallState } from "@/lib/types";

const STATUSES: { value: "" | CallState; label: string }[] = [
  { value: "", label: "All results" },
  { value: "confirmed", label: "Confirmed" },
  { value: "missed", label: "Missed" },
  { value: "retry", label: "Retry" },
  { value: "calling", label: "Calling" },
];

export function HistoryView() {
  const dialogs = useDialogs();
  const family = useFamily();
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState("");
  const [status, setStatus] = useState("");
  const q = useDeferredValue(query.trim());
  const calls = useCalls({ person, status, q });

  if (calls.error) return <LoadError message={calls.error.message} />;
  if (!calls.data) return <Loading />;

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
          <select className="input" aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">All family</option>
            {family.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="input" aria-label="Result" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="list">
        {calls.data.length ? (
          <>
            <div className="thead mono" aria-hidden="true">
              <span>When</span>
              <span>Person</span>
              <span>Reminder</span>
              <span>Result</span>
              <span>Talk</span>
              <span>Tries</span>
            </div>
            {calls.data.map((c) => (
              <button
                key={c.id}
                type="button"
                className="trow"
                onClick={() => dialogs.showCall(c)}
                aria-label={`${c.personName}, ${c.text}, ${fmtDate(c.scheduledAt)} ${fmtTs(c.scheduledAt)}, ${c.status}. Open details`}
              >
                <MonoLabel as="span">
                  {fmtDate(c.scheduledAt)} · {fmtTs(c.scheduledAt)}
                </MonoLabel>
                <span style={{ fontWeight: 500 }}>{c.personName}</span>
                <span className="h-m" style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.text}
                </span>
                <span>
                  <Pill variant={c.status} />
                </span>
                <MonoLabel as="span" className="h-m num">
                  {fmtDuration(c.durationSec)}
                </MonoLabel>
                <MonoLabel as="span" className="h-m num">
                  {c.attempt}
                </MonoLabel>
              </button>
            ))}
          </>
        ) : (
          <EmptyState
            small
            icon={<PhoneIcon />}
            title={q || person || status ? "No calls match" : "No calls yet"}
            description={
              q || person || status
                ? "Try another person or result, or clear the search."
                : "Every call, with its transcript and result, will be listed here."
            }
          />
        )}
      </Card>
    </div>
  );
}
