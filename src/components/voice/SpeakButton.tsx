"use client";

import { SpeakerIcon, SpinnerIcon, StopIcon } from "@/components/ui";
import { SPEECH_ERROR, useSpeech } from "./useSpeech";

type SpeakButtonProps = {
  text: string;
  languageCode: string;
  speaker: string;
  pace?: number;
  /** What is being read, for the accessible name. */
  label?: string;
};

export function SpeakButton({ text, languageCode, speaker, pace, label = "this line" }: SpeakButtonProps) {
  const { state, play, stop } = useSpeech();
  const playing = state === "playing";
  const ariaLabel = playing ? `Stop playing ${label}` : state === "loading" ? `Loading ${label}` : `Play ${label}`;

  return (
    <span className="speak">
      <button
        type="button"
        className="icon-btn"
        data-state={state}
        aria-label={ariaLabel}
        aria-busy={state === "loading"}
        onClick={() => (playing ? stop() : play({ text, languageCode, speaker, pace }))}
      >
        {state === "loading" ? <SpinnerIcon /> : playing ? <StopIcon /> : <SpeakerIcon />}
      </button>
      {state === "error" ? (
        <span className="speak-error" role="alert">
          {SPEECH_ERROR}
        </span>
      ) : null}
    </span>
  );
}
