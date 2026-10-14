"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechState = "idle" | "loading" | "playing" | "error";

export type SpeechRequest = {
  text: string;
  languageCode: string;
  speaker: string;
  pace?: number;
};

export const SPEECH_ERROR = "Couldn't play this voice. Try again.";

// A plain sentence from /api/tts that is safe to show. Anything else (network
// failures, browser playback errors) is replaced with SPEECH_ERROR.
class SpeechError extends Error {}

// Only one clip plays at a time across the whole app.
let current: { audio: HTMLAudioElement; stop: () => void } | null = null;

// Object URLs for clips already fetched in this tab, so replays are instant.
const urls = new Map<string, string>();

async function fetchAudioUrl(req: SpeechRequest) {
  const key = JSON.stringify([req.text, req.languageCode, req.speaker, req.pace ?? 1]);
  const known = urls.get(key);
  if (known) return known;
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, pace: req.pace ?? 1 }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new SpeechError(typeof body?.error === "string" && body.error ? body.error : SPEECH_ERROR);
  }
  const url = URL.createObjectURL(await res.blob());
  urls.set(key, url);
  return url;
}

export function useSpeech() {
  const [state, setState] = useState<SpeechState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runId = useRef(0);

  const stop = useCallback(() => {
    runId.current++;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (current?.audio === audio) current = null;
    setState("idle");
  }, []);

  const play = useCallback(
    async (req: SpeechRequest) => {
      current?.stop();
      const id = ++runId.current;
      setState("loading");
      setMessage(null);
      try {
        const url = await fetchAudioUrl(req);
        if (id !== runId.current) return;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          if (current?.audio === audio) current = null;
          setState("idle");
        };
        current = { audio, stop };
        await audio.play();
        if (id === runId.current) setState("playing");
      } catch (err) {
        if (id !== runId.current) return;
        console.warn("[speech]", (err as Error).message);
        setMessage(err instanceof SpeechError ? err.message : SPEECH_ERROR);
        setState("error");
      }
    },
    [stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { state, message, play, stop };
}
