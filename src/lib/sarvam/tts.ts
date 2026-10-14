import "server-only";

import { concatAudio } from "./audio";
import { splitText, MAX_CHARS } from "./split";

const ENDPOINT = "https://api.sarvam.ai/text-to-speech";
const MODEL = "bulbul:v4-flash";
const MAX_RETRIES = 3;
const TIMEOUT_MS = 20_000;

export type AudioCodec = "mp3" | "wav";

export type SynthesizeInput = {
  text: string;
  languageCode: string;
  speaker: string;
  /** 0.5 to 2.0, default 1.0 */
  pace?: number;
  /** 0.01 to 1.0, default 0.6 */
  temperature?: number;
  codec?: AudioCodec;
  sampleRate?: number;
};

export type SarvamErrorKind =
  | "config" // key missing
  | "bad_request" // 400
  | "forbidden" // 403, key invalid or no access
  | "invalid" // 422, validation
  | "quota" // 429
  | "upstream" // 5xx
  | "network" // timeout or connection failure
  | "bad_response"; // response did not contain audio

export class SarvamError extends Error {
  constructor(
    public readonly kind: SarvamErrorKind,
    message: string,
    public readonly status?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "SarvamError";
  }
}

type SarvamResponse = { request_id?: string | null; audios?: string[] };

function kindForStatus(status: number): SarvamErrorKind {
  if (status === 400) return "bad_request";
  if (status === 401 || status === 403) return "forbidden";
  if (status === 422) return "invalid";
  if (status === 429) return "quota";
  return "upstream";
}

function isRetryable(status: number) {
  return status === 429 || status >= 500;
}

function backoffMs(attempt: number, retryAfter: string | null) {
  const fromHeader = retryAfter ? Number(retryAfter) * 1000 : NaN;
  if (Number.isFinite(fromHeader) && fromHeader > 0) return Math.min(fromHeader, 8000);
  const base = 400 * 2 ** attempt; // 400, 800, 1600
  return base + Math.random() * base * 0.5;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new SarvamError("config", "SARVAM_API_KEY is not set.");
  return key;
}

/** One request to Sarvam for text of at most 2500 characters, with retries. */
async function synthesizeChunk(text: string, input: SynthesizeInput, key: string): Promise<Buffer> {
  const body = {
    text,
    language_code: input.languageCode,
    model: MODEL,
    speaker: input.speaker,
    pace: input.pace ?? 1.0,
    temperature: input.temperature ?? 0.6,
    speech_sample_rate: input.sampleRate ?? 22050,
    output_audio_codec: input.codec ?? "mp3",
  };

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "api-subscription-key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt, null));
        continue;
      }
      throw new SarvamError("network", `Could not reach Sarvam: ${(err as Error).name}`);
    }

    const json = (await res.json().catch(() => ({}))) as SarvamResponse & { error?: { request_id?: string } };
    const requestId = json.request_id ?? json.error?.request_id ?? res.headers.get("x-request-id") ?? undefined;

    if (res.ok) {
      const audio = json.audios?.[0];
      if (!audio) throw new SarvamError("bad_response", "Sarvam returned no audio.", res.status, requestId);
      console.info(`[sarvam] tts ok request_id=${requestId ?? "none"} chars=${text.length}`);
      return Buffer.from(audio, "base64");
    }

    console.warn(`[sarvam] tts failed status=${res.status} request_id=${requestId ?? "none"} attempt=${attempt + 1}`);
    if (isRetryable(res.status) && attempt < MAX_RETRIES) {
      await sleep(backoffMs(attempt, res.headers.get("retry-after")));
      continue;
    }
    throw new SarvamError(kindForStatus(res.status), `Sarvam responded with ${res.status}.`, res.status, requestId);
  }
}

/**
 * Convert text to speech with Sarvam Bulbul v4 flash.
 * Text longer than 2500 characters is split at sentence boundaries and the audio is joined.
 */
export async function synthesize(input: SynthesizeInput): Promise<Buffer> {
  const key = apiKey();
  const text = input.text.trim();
  if (!text) throw new SarvamError("bad_request", "Text is empty.");
  const chunks = text.length > MAX_CHARS ? splitText(text) : [text];
  const parts: Buffer[] = [];
  for (const chunk of chunks) parts.push(await synthesizeChunk(chunk, input, key));
  return concatAudio(parts, input.codec ?? "mp3");
}
