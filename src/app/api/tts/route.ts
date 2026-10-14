import { z } from "zod";
import { cacheKey, getCached, setCached } from "@/lib/server/audio-cache";
import { clientIp, createRateLimiter } from "@/lib/server/rate-limit";
import { SarvamError, synthesize, type SarvamErrorKind } from "@/lib/sarvam/tts";
import { isKnownSpeaker, LANGUAGE_CODES } from "@/lib/voices";

const Body = z
  .object({
    text: z
      .string({ error: "Add some text to speak." })
      .trim()
      .min(1, "Add some text to speak.")
      .max(300, "Text must be 300 characters or fewer."),
    languageCode: z.enum(LANGUAGE_CODES, { error: "This language is not supported." }),
    speaker: z.string({ error: "Choose a voice." }).min(1, "Choose a voice."),
    pace: z
      .number({ error: "Pace must be a number." })
      .min(0.8, "Pace must be between 0.8 and 1.3.")
      .max(1.3, "Pace must be between 0.8 and 1.3.")
      .default(1),
  })
  .refine((b) => isKnownSpeaker(b.languageCode, b.speaker), {
    message: "This voice is not available for the chosen language.",
    path: ["speaker"],
  });

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const FAILURES: Record<SarvamErrorKind, { status: number; error: string }> = {
  config: { status: 503, error: "The voice service is not set up yet." },
  bad_request: { status: 422, error: "The voice service could not read this text." },
  invalid: { status: 422, error: "The voice service could not read this text." },
  forbidden: { status: 503, error: "The voice service rejected the request. Check the API key on the server." },
  quota: { status: 429, error: "The voice service is busy or out of credits. Try again in a minute." },
  upstream: { status: 502, error: "The voice service had a problem. Try again." },
  network: { status: 504, error: "The voice service did not respond in time. Try again." },
  bad_response: { status: 502, error: "The voice service returned no audio. Try again." },
};

function json(status: number, error: string, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  const limit = limiter(clientIp(request));
  if (!limit.ok) {
    return json(429, `Too many voice previews. Try again in ${limit.retryAfterSec} seconds.`, {
      "Retry-After": String(limit.retryAfterSec),
    });
  }

  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return json(400, parsed.error.issues[0]?.message ?? "The request is not valid.");
  }
  const { text, languageCode, speaker, pace } = parsed.data;

  const key = cacheKey([text, languageCode, speaker, pace]);
  let audio = getCached(key);
  const hit = Boolean(audio);

  if (!audio) {
    try {
      audio = await synthesize({ text, languageCode, speaker, pace, codec: "mp3" });
      setCached(key, audio);
    } catch (err) {
      if (err instanceof SarvamError) {
        const f = FAILURES[err.kind];
        return json(f.status, f.error);
      }
      console.error("[tts] unexpected error", (err as Error).message);
      return json(500, "Something went wrong while making the voice. Try again.");
    }
  }

  return new Response(new Uint8Array(audio), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.length),
      "Cache-Control": "private, max-age=3600",
      "X-Cache": hit ? "HIT" : "MISS",
    },
  });
}
