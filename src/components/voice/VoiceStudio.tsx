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
import { renderGreeting } from "@/lib/greetings";
import { LANGUAGES, NO_VOICE_HINT, voicesFor, type LanguageCode } from "@/lib/voices";
import { SPEECH_ERROR, useSpeech } from "./useSpeech";

const NAME = "Amma";
const REMINDER = "BP tablet";
const MAX_TEXT = 300;
const DEFAULT_LANG: LanguageCode = LANGUAGES.find((l) => voicesFor(l.code).length)?.code ?? "hi-IN";

const LANGUAGE_OPTIONS = LANGUAGES.map((l) => {
  const empty = voicesFor(l.code).length === 0;
  return { value: l.code, label: empty ? `${l.label} · ${NO_VOICE_HINT}` : l.label, disabled: empty };
});

export function VoiceStudio() {
  const [lang, setLang] = useState<LanguageCode>(DEFAULT_LANG);
  const [speaker, setSpeaker] = useState(voicesFor(DEFAULT_LANG)[0]?.id ?? "");
  const [pace, setPace] = useState(1);
  const [text, setText] = useState(renderGreeting(DEFAULT_LANG, NAME, REMINDER));
  const { state, message, play, stop } = useSpeech();

  const voices = voicesFor(lang);
  const missing = LANGUAGES.filter((l) => voicesFor(l.code).length === 0).map((l) => l.label);
  const canPlay = Boolean(speaker) && text.trim().length > 0 && text.length <= MAX_TEXT;

  function changeLanguage(code: string) {
    const next = code as LanguageCode;
    setLang(next);
    setSpeaker(voicesFor(next)[0]?.id ?? "");
    setText(renderGreeting(next, NAME, REMINDER));
    stop();
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
            Voice studio
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
              {missing.length ? ` · ${missing.join(", ")}: ${NO_VOICE_HINT.toLowerCase()}` : ""}
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
    </div>
  );
}
