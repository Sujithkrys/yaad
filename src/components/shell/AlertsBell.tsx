"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { BellIcon, MonoLabel } from "@/components/ui";
import { fetcher, refreshAll } from "@/lib/client/api";
import { useWorkspace } from "@/lib/client/hooks";

type Feed = { alerts: { id: string; kind: "missed" | "unwell" | "info"; message: string; createdAt: string; read: boolean }[]; unread: number };

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

/** Family alerts feed: missed reminders and "not feeling well" calls. */
export function AlertsBell() {
  const { workspace } = useWorkspace();
  const { data } = useSWR<Feed>(workspace ? "/api/alerts" : null, fetcher, { refreshInterval: 30_000 });
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!workspace) return null;
  const unread = data?.unread ?? 0;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      await fetch("/api/alerts/read", { method: "POST" }).catch(() => null);
      refreshAll();
    }
  }

  return (
    <div className="bell" ref={wrap}>
      <button
        type="button"
        className="btn-ghost bell-btn"
        aria-label={unread ? `Family alerts, ${unread} new` : "Family alerts"}
        aria-expanded={open}
        onClick={toggle}
      >
        <BellIcon />
        {unread ? <span className="bell-count num">{unread}</span> : null}
      </button>
      {open ? (
        <div className="card bell-pop" role="dialog" aria-label="Family alerts">
          <div className="bell-head">
            <MonoLabel>Family alerts</MonoLabel>
          </div>
          {data?.alerts.length ? (
            <ul className="bell-list">
              {data.alerts.map((a) => (
                <li key={a.id} data-kind={a.kind} className={a.read ? undefined : "unread"}>
                  <span className="sq" aria-hidden="true" />
                  <div>
                    <div>{a.message}</div>
                    <MonoLabel as="span">{ago(a.createdAt)}</MonoLabel>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bell-empty">No alerts. You will see missed reminders here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
