"use client";

import { CloseIcon, Modal, MonoLabel, Pill } from "@/components/ui";
import { useAppState } from "@/lib/app/store";
import { fmtDate, fmtDuration, fmtTs } from "@/lib/app/time";
import type { CallRecord } from "@/lib/app/types";
import { LANGUAGES, voicesFor } from "@/lib/voices";
import { Transcript } from "./Transcript";

const OUTCOME_TEXT = {
  taken: "Said they had done it",
  later: "Said they would do it later",
  not_taken: "Said they had not done it",
  no_answer: "Did not answer",
} as const;

export function CallDrawer({ call, onClose }: { call: CallRecord | null; onClose: () => void }) {
  return (
    <Modal open={call !== null} onClose={onClose} labelledBy="call-title" drawer>
      {call ? <CallDetails call={call} onClose={onClose} /> : null}
    </Modal>
  );
}

function CallDetails({ call, onClose }: { call: CallRecord; onClose: () => void }) {
  const state = useAppState();
  const { person, reminder } = call;
  const langLabel = LANGUAGES.find((l) => l.code === person.lang)?.label ?? person.lang;
  const voice = voicesFor(person.lang)[0];
  const retryMin = state?.settings.retryMin ?? 10;
  const alerted = call.status === "missed" && state?.settings.alertFamily;

  return (
    <div className="dlg">
      <div className="dlg-head">
        <h2 id="call-title">
          {person.name} · {reminder.text}
        </h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="dlg-body">
        <div className="meta-grid">
          <Meta label="Status" value={<Pill variant={call.status} />} />
          <Meta label="Scheduled" value={`${fmtDate(call.scheduledTs)} · ${fmtTs(call.scheduledTs)}`} />
          <Meta label="Answered" value={call.answeredTs ? fmtTs(call.answeredTs) : "–"} />
          <Meta label="Attempts" value={String(call.attempts)} />
          <Meta label="Talk time" value={fmtDuration(call.durationSec)} />
          <Meta label="Result" value={call.outcome ? OUTCOME_TEXT[call.outcome] : "In progress"} />
        </div>

        {call.firstOutcome ? (
          <p className="warn">
            First call: {OUTCOME_TEXT[call.firstOutcome].toLowerCase()}. Retried after {retryMin} minutes.
          </p>
        ) : null}
        {call.status === "missed" ? (
          <p className="err">{alerted ? "Missed twice. Family was alerted." : "Missed twice. Family alerts are off in settings."}</p>
        ) : null}

        <div className="field">
          <span className="lbl">Sent to the voice agent</span>
          <div className="vars">
            <div><span>name</span><span>{person.name}</span></div>
            <div><span>reminder</span><span>{reminder.text}</span></div>
            <div><span>language</span><span>{person.lang} · {langLabel}</span></div>
            <div><span>voice</span><span>{voice?.id ?? "not set"}</span></div>
            <div><span>model</span><span>bulbul:v4-flash</span></div>
            <div><span>retry_after</span><span>{retryMin} min</span></div>
          </div>
        </div>

        <div className="field">
          <span className="lbl">Transcript</span>
          {call.outcome && call.outcome !== "no_answer" ? (
            <Transcript lang={person.lang} name={person.name} reminder={reminder.text} outcome={call.outcome} />
          ) : (
            <MonoLabel>{call.outcome === "no_answer" ? "No answer on either attempt" : "Call in progress"}</MonoLabel>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <MonoLabel>{label}</MonoLabel>
      <div className="v">{value}</div>
    </div>
  );
}
