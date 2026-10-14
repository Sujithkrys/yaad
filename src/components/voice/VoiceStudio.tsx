"use client";

import { useState } from "react";
import {
  Button,
  Card,
  ChipSelect,
  MonoLabel,
  Panel,
  PanelFoot,
  PanelHead,
  PanelTitle,
  SparkleIcon,
  SpeakerIcon,
  SpinnerIcon,
  StopIcon,
} from "@/components/ui";
import { useFamily, useReminders } from "@/lib/client/hooks";
import { renderGreeting } from "@/lib/greetings";
import { LANGUAGES, NO_VOICE_HINT, voicesFor, type LanguageCode } from "@/lib/voices";
import { SPEECH_ERROR, useSpeech } from "./useSpeech";

const NAME = "Amma";
const REMINDER = "BP tablet";
const MAX_TEXT = 300;
const DEFAULT_LANG: LanguageCode = LANGUAGES.find((l) => voicesFor(l.code).length)?.code ?? "hi-IN";

// Languages without a voice stay selectable so the text can still be read; only Play waits.
const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({
  value: l.code,
  label: voicesFor(l.code).length ? l.label : `${l.label} · ${NO_VOICE_HINT.toLowerCase()}`,
}));

export function VoiceStudio() {
  const [lang, setLang] = useState<LanguageCode>(DEFAULT_LANG);
  const [speaker, setSpeaker] = useState(voicesFor(DEFAULT_LANG)[0]?.id ?? "");
  const [pace, setPace] = useState(1);
  const [text, setText] = useState(renderGreeting(DEFAULT_LANG, NAME, REMINDER));
  const [reminderId, setReminderId] = useState("");
  const { state, message, play, stop } = useSpeech();
  const reminders = useReminders().data;
  const family = useFamily().data;

  const voices = voicesFor(lang);
  const langLabel = LANGUAGES.find((l) => l.code === lang)?.label ?? lang;
  const people = new Map((family ?? []).map((p) => [p.id, p]));
  const reminderOptions = (reminders ?? []).flatMap((r) => {
    const person = people.get(r.personId);
    return person ? [{ value: r.id, label: `${person.name} · ${r.text}` }] : [];
  });
  const canPlay = Boolean(speaker) && text.trim().length > 0 && text.length <= MAX_TEXT;

  function switchLanguage(next: LanguageCode) {
    setLang(next);
    setSpeaker(voicesFor(next)[0]?.id ?? "");
    stop();
  }

  function changeLanguage(code: string) {
    const next = code as LanguageCode;
    switchLanguage(next);
    setReminderId("");
    setText(renderGreeting(next, NAME, REMINDER));
  }

  function pickReminder(id: string) {
    setReminderId(id);
    const reminder = reminders?.find((r) => r.id === id);
    const person = reminder && people.get(reminder.personId);
    if (!reminder || !person) return;
    const next = reminder.lang ?? person.lang;
    switchLanguage(next);
    setText(renderGreeting(next, person.name, reminder.text).slice(0, MAX_TEXT));
  }

  function onPlay() {
    if (state === "playing" || state === "loading") return stop();
    play({ text: text.trim(), languageCode: lang, speaker, pace });
  }

  return (
    <div className="studio">
      <Panel aria-labelledby="studio-title">
        <PanelHead>
          <PanelTitle id="studio-title" info="Preview how the agent will sound when it calls. Previews are cached, so replays are free.">
            Voice preview
          </PanelTitle>
          <span className="model-chip">
            <SparkleIcon />
            bulbul-v4-flash
          </span>
        </PanelHead>

        <Card className="studio-form">
          <div className="field-row">
            <div className="field">
              <label className="mono" htmlFor="studio-lang">
                Language
              </label>
              <ChipSelect id="studio-lang" label="Language" value={lang} options={LANGUAGE_OPTIONS} onChange={changeLanguage} />
            </div>
            <div className="field">
              <label className="mono" htmlFor="studio-voice">
                Voice
              </label>
              <ChipSelect
                id="studio-voice"
                label="Voice"
                value={speaker}
                disabled={voices.length === 0}
                options={voices.length ? voices.map((v) => ({ value: v.id, label: v.label })) : [{ value: "", label: NO_VOICE_HINT }]}
                onChange={setSpeaker}
              />
            </div>
          </div>

          <div className="field">
            <label className="mono" htmlFor="studio-pace">
              Pace <b className="num">{pace.toFixed(2)}×</b>
            </label>
            <div className="range-row">
              <MonoLabel as="span" aria-hidden="true">
                Slower
              </MonoLabel>
              <input
                id="studio-pace"
                className="range"
                type="range"
                min={0.8}
                max={1.3}
                step={0.05}
                value={pace}
                onChange={(e) => setPace(Number(e.target.value))}
              />
              <MonoLabel as="span" aria-hidden="true">
                Faster
              </MonoLabel>
            </div>
          </div>

          <div className="field">
            <label className="mono" htmlFor="studio-reminder">
              Use a reminder
            </label>
            <ChipSelect
              id="studio-reminder"
              label="Use a reminder"
              value={reminderId}
              disabled={reminderOptions.length === 0}
              options={[{ value: "", label: reminderOptions.length ? "Choose a reminder" : "No reminders yet" }, ...reminderOptions]}
              onChange={pickReminder}
            />
          </div>

          <div className="field">
            <label className="mono" htmlFor="studio-text">
              What the agent says
            </label>
            <textarea
              id="studio-text"
              className="textarea"
              lang={lang.split("-")[0]}
              value={text}
              maxLength={MAX_TEXT}
              onChange={(e) => setText(e.target.value)}
            />
            <span className="hint num">
              {text.length} / {MAX_TEXT} characters
              {voices.length ? "" : ` · ${langLabel}: ${NO_VOICE_HINT.toLowerCase()}, so Play is off for now`}
            </span>
          </div>
        </Card>

        <PanelFoot>
          <div className="foot-note" role="status">
            {state === "error" ? (message ?? SPEECH_ERROR) : state === "playing" ? <b>Playing</b> : "Ready when you are"}
          </div>
          <Button onClick={onPlay} disabled={!canPlay}>
            {state === "loading" ? <SpinnerIcon size={13} /> : state === "playing" ? <StopIcon size={13} /> : <SpeakerIcon size={13} />}
            {state === "loading" ? "Loading voice" : state === "playing" ? "Stop" : "Play voice"}
          </Button>
        </PanelFoot>
      </Panel>
      <p className="studio-note">A preview of the reminder voice, powered by Bulbul V4 Flash. Calls use the same Bulbul voices.</p>
    </div>
  );
}
