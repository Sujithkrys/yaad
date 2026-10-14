"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cleanPhone, RELATIONS } from "@/components/app/PersonDialog";
import { useToast } from "@/components/shell/Toast";
import { Button, Card, MonoLabel, SegmentedControl, SpeakerIcon, SpinnerIcon, StopIcon } from "@/components/ui";
import { useSpeech } from "@/components/voice/useSpeech";
import { addPerson, addReminder, useAppState } from "@/lib/app/store";
import { fmtHHMM, nextOnceDay } from "@/lib/app/time";
import type { ReminderKind, Repeat } from "@/lib/app/types";
import { englishGreeting } from "@/lib/conversation";
import { renderGreeting } from "@/lib/greetings";
import { LANGUAGES, NO_VOICE_HINT, voicesFor } from "@/lib/voices";

const CHIPS = ["BP tablet", "Sugar tablet", "Morning walk", "Drink water", "Doctor visit"];
const STEPS = 3;

export function SetupWizard() {
  const router = useRouter();
  const say = useToast();
  const state = useAppState();
  const speech = useSpeech();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [relation, setRelation] = useState("Mother");
  const [phone, setPhone] = useState("");
  const [lang, setLang] = useState("te-IN");
  const [text, setText] = useState("BP tablet");
  const [time, setTime] = useState("19:00");
  const [repeat, setRepeat] = useState<Repeat>("daily");

  const owner = state?.user.name ?? "Your family";
  const langLabel = LANGUAGES.find((l) => l.code === lang)?.label ?? lang;
  const voice = voicesFor(lang)[0];
  const preview = renderGreeting(lang, name.trim() || "Amma", text.trim() || "BP tablet");

  function next() {
    setError(null);
    if (step === 1) {
      if (!name.trim()) return setError("Add the name they answer to, like Amma.");
      if (!cleanPhone(phone)) return setError("Enter a 10 digit mobile number.");
    }
    if (step === 2) {
      if (!text.trim()) return setError("Say what the reminder is for, like BP tablet.");
      if (!time) return setError("Pick a time for the call.");
    }
    if (step < STEPS) return setStep(step + 1);
    finish();
  }

  function finish() {
    const digits = cleanPhone(phone);
    if (!digits) return;
    const personId = addPerson({ name: name.trim(), relation, phone: digits, lang });
    const kind: ReminderKind = /walk/i.test(text) ? "walk" : /doctor|visit/i.test(text) ? "visit" : "tablet";
    addReminder({
      personId,
      text: text.trim(),
      kind,
      time,
      repeat,
      onceDay: repeat === "once" ? nextOnceDay(time) : undefined,
    });
    say(`Consent message sent to ${name.trim()}. Calls start after they agree.`);
    router.push("/family");
  }

  return (
    <section className="panel wiz" aria-labelledby="wiz-title">
      <div className="panel-head">
        <h1 className="title" id="wiz-title" style={{ margin: 0 }}>
          Set up Yaad
        </h1>
        <MonoLabel as="span">
          Step {step} of {STEPS}
        </MonoLabel>
      </div>
      <div className="wiz-prog" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={i < step ? "on" : undefined} />
        ))}
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <Card className="wiz-card">
          {step === 1 ? (
            <>
              <h2>Who should Yaad call?</h2>
              <p className="lead">The agent greets them by this name, in their language.</p>
              <div className="two">
                <div className="field">
                  <label htmlFor="wz-name">Name they answer to</label>
                  <input id="wz-name" className="input" maxLength={30} placeholder="Amma" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="wz-rel">Relation</label>
                  <select id="wz-rel" className="input" value={relation} onChange={(e) => setRelation(e.target.value)}>
                    {RELATIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="two">
                <div className="field">
                  <label htmlFor="wz-phone">Mobile number</label>
                  <input id="wz-phone" className="input" inputMode="numeric" maxLength={11} placeholder="98765 43210" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="wz-lang">Language</label>
                  <select id="wz-lang" className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2>What should we remind {name.trim()} about?</h2>
              <p className="lead">Pick one now. You can add more from the dashboard.</p>
              <div className="field">
                <label htmlFor="wz-text">What is it for</label>
                <input id="wz-text" className="input" maxLength={60} placeholder="BP tablet" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
                <div className="chips">
                  {CHIPS.map((c) => (
                    <button key={c} type="button" onClick={() => setText(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="two">
                <div className="field">
                  <label htmlFor="wz-time">Time</label>
                  <input id="wz-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
                <div className="field">
                  <span className="lbl">Repeat</span>
                  <SegmentedControl
                    className="wide"
                    label="Repeat"
                    value={repeat}
                    onChange={setRepeat}
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekdays", label: "Weekdays" },
                      { value: "once", label: "Once" },
                    ]}
                  />
                </div>
              </div>
              <div className="card preview">
                <div className="mono">What they will hear</div>
                <div className="te" lang={lang.split("-")[0]}>
                  {preview}
                </div>
                <div className="en">{englishGreeting(name.trim() || "Amma", text.trim() || "BP tablet")}</div>
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
                  {!voice ? NO_VOICE_HINT : speech.state === "playing" ? "Stop" : "Play"}
                </Button>
                {speech.state === "error" ? <p className="warn">{speech.message}</p> : null}
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h2>Ask {name.trim()} first</h2>
              <p className="lead">Yaad only calls people who agree. We send this message now.</p>
              <div className="consent-msg">
                Namaste {name.trim()}. {owner} has set up Yaad to call you at {fmtHHMM(time)} to remind you about {text.trim()},
                in {langLabel}. Reply YES to allow these calls, or STOP at any time.
                <small>
                  Sent by SMS to +91 {phone.replace(/\D/g, "").replace(/(\d{5})(\d{5})/, "$1 $2")} on behalf of {owner}
                </small>
              </div>
            </>
          ) : null}

          {error ? (
            <p className="err" role="alert">
              {error}
            </p>
          ) : null}
        </Card>

        <div className="panel-foot">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => {
                setError(null);
                setStep(step - 1);
              }}>
              Back
            </Button>
          ) : (
            <MonoLabel as="span">Takes about a minute</MonoLabel>
          )}
          <Button type="submit">{step < STEPS ? "Continue" : "Send and finish"}</Button>
        </div>
      </form>
    </section>
  );
}
