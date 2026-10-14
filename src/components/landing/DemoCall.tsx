"use client";

import { useEffect, useState } from "react";
import { Button, MonoLabel, Pill } from "@/components/ui";
import { transcriptFor } from "@/lib/conversation";

const LINES = transcriptFor("te-IN", "Amma", "BP tablet", "taken");
const STEP_MS = 1700;

/** The animated example call in the landing hero. */
export function DemoCall() {
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= LINES.length + 1; i++) {
      timers.push(setTimeout(() => setShown(i), reduce ? 0 : 600 + (i - 1) * STEP_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, [run]);

  const done = shown > LINES.length;

  return (
    <section className="panel demo" aria-label="Example call">
      <div className="panel-head">
        <div className="title">
          <span>{done ? "Called Amma" : "Calling Amma"}</span>
        </div>
        <Pill variant={done ? "confirmed" : "calling"} />
      </div>
      <div className="card demo-stage" aria-live="polite">
        {LINES.slice(0, shown).map((l) => (
          <div key={`${run}-${l.at}`} className={`dl ${l.role}`}>
            <span className="sq" aria-hidden="true" />
            <div>
              <div className="te" lang="te">
                {l.native}
              </div>
              <div className="en">{l.english}</div>
            </div>
          </div>
        ))}
        {done ? <div className="demo-note">Confirmed. Pavan gets a message: Amma took her BP tablet.</div> : null}
      </div>
      <div className="panel-foot">
        <MonoLabel as="span">BP tablet · 7:00 PM · Telugu</MonoLabel>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShown(0);
            setRun((r) => r + 1);
          }}
        >
          Replay
        </Button>
      </div>
    </section>
  );
}
