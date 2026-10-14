"use client";

import { Button, SpeakerIcon, SpinnerIcon, StopIcon } from "@/components/ui";
import { useSpeech } from "@/components/voice/useSpeech";
import { renderGreeting } from "@/lib/greetings";
import { LANGUAGES, voicesFor } from "@/lib/voices";

// Prefer Telugu to match the demo; fall back to the first language with a voice.
const SAMPLE_LANG = voicesFor("te-IN").length ? "te-IN" : (LANGUAGES.find((l) => voicesFor(l.code).length)?.code ?? null);
const SAMPLE_LABEL = LANGUAGES.find((l) => l.code === SAMPLE_LANG)?.label;

export function HearSample() {
  const speech = useSpeech();
  if (!SAMPLE_LANG) return null;
  const voice = voicesFor(SAMPLE_LANG)[0];
  const busy = speech.state === "playing" || speech.state === "loading";

  return (
    <>
      <Button
        variant="ghost"
        onClick={() =>
          busy
            ? speech.stop()
            : speech.play({ text: renderGreeting(SAMPLE_LANG, "Amma", "BP tablet"), languageCode: SAMPLE_LANG, speaker: voice.id })
        }
      >
        {speech.state === "loading" ? <SpinnerIcon /> : speech.state === "playing" ? <StopIcon /> : <SpeakerIcon />}
        {speech.state === "playing" ? "Stop" : SAMPLE_LANG === "te-IN" ? "Hear a sample" : `Hear a sample in ${SAMPLE_LABEL}`}
      </Button>
      {speech.state === "error" ? (
        <span className="warn" role="alert">
          {speech.message}
        </span>
      ) : null}
    </>
  );
}
