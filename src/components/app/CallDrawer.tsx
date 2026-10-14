"use client";

import type { ReactNode } from "react";
import { CloseIcon, Modal, MonoLabel, Pill } from "@/components/ui";
import { useSettings } from "@/lib/client/hooks";
import { fmtDate, fmtDuration, fmtTs } from "@/lib/time";
import type { Call, Response } from "@/lib/types";
import { LANGUAGES, voicesFor } from "@/lib/voices";
import { Transcript } from "./Transcript";

const RESPONSE_TEXT: Record<Response, string> = {
  taken: "Said they had done it",
  later: "Said they would do it later",
  not_taken: "Said they had not done it",
  no_answer: "Did not answer",
  unclear: "Answer was not clear",
};

export function CallDrawer({ call, onClose }: { call: Call | null; onClose: () => void }) {
  return (
    <Modal open={call !== null} onClose={onClose} labelledBy="call-title" drawer>
      {call ? <CallDetails call={call} onClose={onClose} /> : null}
    </Modal>
  );
}

function CallDetails({ call, onClose }: { call: Call; onClose: () => void }) {
  const settings = useSettings().data;
  const langLabel = LANGUAGES.find((l) => l.code === call.lang)?.label ?? call.lang;
  const voice = voicesFor(call.lang)[0];
  const retryMin = settings?.retryMin ?? 10;

  return (
    <div className="dlg">
      <div className="dlg-head">
        <h2 id="call-title">
          {call.personName} · {call.text}
        </h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="dlg-body">
        <div className="meta-grid">
          <Meta label="Status" value={<Pill variant={call.status} />} />
          <Meta label="Scheduled" value={`${fmtDate(call.scheduledAt)} · ${fmtTs(call.scheduledAt)}`} />
          <Meta label="Finished" value={call.doneAt ? fmtTs(call.doneAt) : "–"} />
          <Meta label="Attempts" value={String(call.attempt)} />
          <Meta label="Talk time" value={fmtDuration(call.durationSec)} />
          <Meta label="Result" value={call.response ? RESPONSE_TEXT[call.response] : "In progress"} />
        </div>

        {call.attempt > 1 && call.status === "confirmed" ? <p className="warn">Taken after a retry, {retryMin} minutes after the first call.</p> : null}
        {call.status === "missed" ? (
          <p className="err">{call.alerted ? "Missed. Family was alerted." : "Missed. No alert was sent."}</p>
        ) : null}
        {call.manual ? <MonoLabel>Placed by hand with call now</MonoLabel> : null}

        <div className="field">
          <span className="lbl">Sent to the voice agent</span>
          <div className="vars">
            <div><span>name</span><span>{call.personName}</span></div>
            <div><span>reminder</span><span>{call.text}</span></div>
            <div><span>language</span><span>{call.lang} · {langLabel}</span></div>
            <div><span>voice</span><span>{voice?.id ?? "not set"}</span></div>
            <div><span>model</span><span>bulbul:v4-flash</span></div>
            <div><span>retry_after</span><span>{retryMin} min</span></div>
          </div>
        </div>

        <div className="field">
          <span className="lbl">Transcript</span>
          {call.lines.length ? (
            <Transcript lines={call.lines} lang={call.lang} name={call.personName} />
          ) : (
            <MonoLabel>{call.response === "no_answer" ? "No answer" : "No transcript for this call"}</MonoLabel>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <MonoLabel>{label}</MonoLabel>
      <div className="v">{value}</div>
    </div>
  );
}
