import Link from "next/link";
import { ArrowRightIcon, Card, MonoLabel, Panel, PanelFoot, PanelHead, PanelTitle, SparkleIcon } from "@/components/ui";
import { buildWaveform, lastCall } from "@/lib/sample-data";
import { voicesFor } from "@/lib/voices";
import { SpeakButton } from "@/components/voice/SpeakButton";

export function LastCallPanel() {
  const wave = buildWaveform();
  // Telugu voice for the agent lines; the button is hidden until one is configured.
  const voice = voicesFor("te-IN")[0];
  return (
    <Panel aria-labelledby="c-title">
      <PanelHead>
        <PanelTitle id="c-title">Last call</PanelTitle>
        <span className="model-chip">
          <SparkleIcon />
          {lastCall.model}
        </span>
      </PanelHead>

      <Card className="call-hero">
        <div className="hero-row">
          <div className="big num">
            {lastCall.seconds}
            <small style={{ marginLeft: 2 }}>s</small>
            <span className="name">
              {lastCall.who} · {lastCall.what}
            </span>
          </div>
          <span className="good-txt">{lastCall.outcome}</span>
        </div>
        <div className="wave" aria-hidden="true">
          {wave.map((b, i) => (
            <span key={i} className={b.who || undefined} style={{ height: b.height }} />
          ))}
        </div>
      </Card>

      <Card className="lines fill">
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Call transcript">
          {lastCall.transcript.map((l) => (
            <li key={l.at} className={`line ${l.speaker}`}>
              <span className="sq" aria-hidden="true" />
              <div>
                <span className="sr-only">{l.speaker === "agent" ? "Agent:" : `${lastCall.who}:`}</span>
                <div className="te" lang={lastCall.langCode}>
                  {l.native}
                </div>
                <div className="en">{l.english}</div>
              </div>
              <span className="end">
                {voice && l.speaker === "agent" ? (
                  <SpeakButton text={l.native} languageCode="te-IN" speaker={voice.id} label={`agent line at ${l.at}`} />
                ) : null}
                <MonoLabel as="span" className="ts">
                  {l.at}
                </MonoLabel>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <PanelFoot>
        <div className="foot-note">
          <b>{lastCall.outcome}</b> · {lastCall.footnote}
        </div>
        <Link className="link-btn" href="/history">
          All calls
          <ArrowRightIcon />
        </Link>
      </PanelFoot>
    </Panel>
  );
}
