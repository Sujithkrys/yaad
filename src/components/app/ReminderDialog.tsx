"use client";

import { useState, type FormEvent } from "react";
import { useToast } from "@/components/shell/Toast";
import { Button, CloseIcon, Modal, SegmentedControl, SpeakerIcon, SpinnerIcon, StopIcon } from "@/components/ui";
import { useSpeech } from "@/components/voice/useSpeech";
import { api } from "@/lib/client/api";
import { useFamily, useReminders, useSettings } from "@/lib/client/hooks";
import { englishGreeting } from "@/lib/conversation";
import { inQuiet } from "@/lib/derive";
import { renderGreeting } from "@/lib/greetings";
import { fmtHHMM, nextOnceDay } from "@/lib/time";
import type { Lang, Person, Reminder, ReminderKind, Repeat, Settings } from "@/lib/types";
import { LANGUAGES, NO_VOICE_HINT, voicesFor } from "@/lib/voices";

const CHIPS = ["BP tablet", "Sugar tablet", "Morning walk", "Drink water", "Doctor visit"];
const REPEATS: { value: Repeat; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "once", label: "Once" },
];
const KINDS: { value: ReminderKind; label: string }[] = [
  { value: "tablet", label: "Tablet" },
  { value: "walk", label: "Walk" },
  { value: "visit", label: "Visit" },
];

export function guessKind(text: string): ReminderKind {
  const t = text.toLowerCase();
  if (/walk|exercise|yoga/.test(t)) return "walk";
  if (/doctor|visit|appointment|check/.test(t)) return "visit";
  return "tablet";
}

type Props = {
  open: boolean;
  reminderId?: string;
  personId?: string;
  onClose: () => void;
  onAddPerson: () => void;
};

export function ReminderDialog(props: Props) {
  const family = useFamily().data;
  const reminders = useReminders().data;
  const settings = useSettings().data;
  const ready = family && reminders && settings;
  return (
    <Modal open={props.open && Boolean(ready)} onClose={props.onClose} labelledBy="rem-title">
      {ready ? <ReminderForm {...props} family={family} reminders={reminders} settings={settings} /> : null}
    </Modal>
  );
}

type FormProps = Props & { family: Person[]; reminders: Reminder[]; settings: Settings };

function ReminderForm({ family, reminders, settings, reminderId, personId, onClose, onAddPerson }: FormProps) {
  const say = useToast();
  const existing = reminders.find((r) => r.id === reminderId);
  const firstPerson = family.find((p) => p.id === (existing?.personId ?? personId)) ?? family[0];

  const [pid, setPid] = useState(firstPerson?.id ?? "");
  const [text, setText] = useState(existing?.text ?? "");
  const [time, setTime] = useState(existing?.time ?? "19:00");
  const [repeat, setRepeat] = useState<Repeat>(existing?.repeat ?? "daily");
  const [kind, setKind] = useState<ReminderKind>(existing?.kind ?? "tablet");
  const [lang, setLang] = useState<Lang>(existing?.lang ?? firstPerson?.lang ?? settings.defaultLang);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const speech = useSpeech();

  const person = family.find((p) => p.id === pid);
  const voice = voicesFor(lang)[0];
  const sampleName = person?.name || "Amma";
  const sampleText = text.trim() || "BP tablet";
  const preview = renderGreeting(lang, sampleName, sampleText);

  const warnings: string[] = [];
  if (person?.consent === "pending") warnings.push(`${person.name} has not agreed to calls yet. This reminder starts after they agree.`);
  if (inQuiet(time, settings)) {
    warnings.push(`${fmtHHMM(time)} is inside quiet hours (${fmtHHMM(settings.quietFrom)} to ${fmtHHMM(settings.quietTo)}), so this call will not ring.`);
  }

  function pickPerson(id: string) {
    setPid(id);
    const p = family.find((f) => f.id === id);
    if (p) setLang(p.lang);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!person) return setError("Choose who we should call.");
    if (!text.trim()) return setError("Say what the reminder is for, like BP tablet.");
    if (!time) return setError("Pick a time for the call.");
    const data = {
      personId: person.id,
      text: text.trim(),
      time,
      repeat,
      kind,
      onceDay: repeat === "once" ? nextOnceDay(time) : null,
      // Only store a language when it differs from the person's own.
      lang: lang === person.lang ? null : lang,
    };
    setSaving(true);
    setError(null);
    try {
      if (existing) await api.updateReminder(existing.id, data);
      else await api.addReminder(data);
      say(`Reminder saved. ${person.name} gets a call at ${fmtHHMM(time)}.`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  if (!family.length) {
    return (
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="rem-title">New reminder</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="dlg-body">
          <p style={{ margin: 0 }}>Add a family member first, so Yaad knows who to call.</p>
        </div>
        <div className="dlg-foot">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onAddPerson}>Add family member</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="dlg" noValidate onSubmit={submit}>
      <div className="dlg-head">
        <h2 id="rem-title">{existing ? "Edit reminder" : "New reminder"}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="dlg-body">
        <div className="field">
          <label htmlFor="rem-person">Who should we call</label>
          <select id="rem-person" className="input" value={pid} onChange={(e) => pickPerson(e.target.value)}>
            {family.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.relation}
                {p.consent === "pending" ? " · waiting for consent" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="rem-text">What is it for</label>
          <input
            id="rem-text"
            className="input"
            maxLength={60}
            placeholder="BP tablet"
            autoComplete="off"
            value={text}
            aria-invalid={error !== null && !text.trim()}
            onChange={(e) => {
              setText(e.target.value);
              setKind(guessKind(e.target.value));
            }}
          />
          <div className="chips">
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setText(c);
                  setKind(guessKind(c));
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="two">
          <div className="field">
            <label htmlFor="rem-time">Time</label>
            <input id="rem-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="field">
            <span className="lbl">Repeat</span>
            <SegmentedControl className="wide" label="Repeat" options={REPEATS} value={repeat} onChange={setRepeat} />
          </div>
        </div>

        <div className="two">
          <div className="field">
            <label htmlFor="rem-lang">Language</label>
            <select id="rem-lang" className="input" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="lbl">Type</span>
            <SegmentedControl className="wide" label="Type" options={KINDS} value={kind} onChange={setKind} />
          </div>
        </div>

        <div className="card preview">
          <div className="mono">What they will hear</div>
          <div className="te" lang={lang.split("-")[0]}>
            {preview}
          </div>
          <div className="en">{englishGreeting(sampleName, sampleText)}</div>
          <Button
            variant="ghost"
            size="sm"
            disabled={!voice}
            onClick={() =>
              speech.state === "playing" || speech.state === "loading"
                ? speech.stop()
                : voice && speech.play({ text: preview, languageCode: lang, speaker: voice.id })
            }
          >
            {speech.state === "loading" ? <SpinnerIcon size={13} /> : speech.state === "playing" ? <StopIcon size={13} /> : <SpeakerIcon size={13} />}
            {!voice ? NO_VOICE_HINT : speech.state === "playing" ? "Stop" : speech.state === "loading" ? "Loading" : "Play"}
          </Button>
          {speech.state === "error" ? <p className="warn">{speech.message}</p> : null}
        </div>

        {warnings.map((w) => (
          <p className="warn" key={w}>
            {w}
          </p>
        ))}
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="dlg-foot">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save reminder"}
        </Button>
      </div>
    </form>
  );
}
