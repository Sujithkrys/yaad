"use client";

import Link from "next/link";
import { ArrowRightIcon, Card, EmptyState, MonoLabel, Panel, PanelFoot, PanelHead, PanelTitle, SparkleIcon } from "@/components/ui";
import { SpeakButton } from "@/components/voice/SpeakButton";
import { useDialogs } from "@/components/app/DialogsProvider";
import type { CallRecord } from "@/lib/app/types";
import { transcriptFor } from "@/lib/conversation";
import { voicesFor } from "@/lib/voices";

function waveform(call: CallRecord, bars = 64) {
  let seed = [...call.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) | 0, 7);
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const total = Math.max(call.durationSec, 1);
  return Array.from({ length: bars }, (_, i) => {
    const sec = (i / bars) * total;
    const f = sec / total;
    const who: "a" | "b" | "" = f < 0.24 || (f > 0.45 && f < 0.78) ? "a" : (f > 0.27 && f < 0.43) || f > 0.82 ? "b" : "";
    return { who, height: who ? 8 + Math.round(rand() * 24) : 4 };
  });
}

export function LastCallPanel({ call, alerts }: { call: CallRecord | undefined; alerts: boolean }) {
  const dialogs = useDialogs();

  if (!call) {
    return (
      <Panel aria-labelledby="c-title">
        <PanelHead>
          <PanelTitle id="c-title">Last call</PanelTitle>
        </PanelHead>
        <Card className="fill">
          <EmptyState small title="No calls yet" description="The most recent call and its transcript will show here." />
        </Card>
      </Panel>
    );
  }

  const { person, reminder } = call;
  const voice = voicesFor(person.lang)[0];
  const lines = call.outcome ? transcriptFor(person.lang, person.name, reminder.text, call.outcome) : [];
  const confirmed = call.status === "confirmed";
  const footnote = confirmed ? "no alert sent to family" : alerts ? "family alerted" : "family alerts are off";

  return (
    <Panel aria-labelledby="c-title">
      <PanelHead>
        <PanelTitle id="c-title">Last call</PanelTitle>
        <span className="model-chip">
          <SparkleIcon />
          bulbul-v4-flash
        </span>
      </PanelHead>

      <Card className="call-hero">
        <div className="hero-row">
          <div className="big num">
            {call.durationSec}
            <small style={{ marginLeft: 2 }}>s</small>
            <span className="name">
              {person.name} · {reminder.text}
            </span>
          </div>
          <span className="good-txt" style={confirmed ? undefined : { color: "var(--bad)" }}>
            {confirmed ? "Confirmed" : "Missed"}
          </span>
        </div>
        <div className="wave" aria-hidden="true">
          {waveform(call).map((b, i) => (
            <span key={i} className={b.who || undefined} style={{ height: b.height }} />
          ))}
        </div>
      </Card>

      <Card className="lines fill">
        {lines.length ? (
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Call transcript">
            {lines.map((l) => (
              <li key={l.at} className={`line ${l.role === "agent" ? "agent" : "parent"}`}>
                <span className="sq" aria-hidden="true" />
                <div>
                  <span className="sr-only">{l.role === "agent" ? "Agent:" : `${person.name}:`}</span>
                  <div className="te" lang={person.lang.split("-")[0]}>
                    {l.native}
                  </div>
                  <div className="en">{l.english}</div>
                </div>
                <span className="end">
                  {voice && l.role === "agent" ? (
                    <SpeakButton text={l.native} languageCode={person.lang} speaker={voice.id} label={`agent line at ${l.at}`} />
                  ) : null}
                  <MonoLabel as="span" className="ts">
                    {l.at}
                  </MonoLabel>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState small title="No answer" description={`${person.name} did not pick up on either attempt.`} />
        )}
      </Card>

      <PanelFoot>
        <div className="foot-note">
          <b>{confirmed ? "Confirmed" : "Missed"}</b> · {footnote}
        </div>
        <span style={{ display: "flex", gap: 4 }}>
          <button type="button" className="link-btn" onClick={() => dialogs.showCall(call)}>
            Details
          </button>
          <Link className="link-btn" href="/history">
            All calls
            <ArrowRightIcon />
          </Link>
        </span>
      </PanelFoot>
    </Panel>
  );
}
