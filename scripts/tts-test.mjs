// Verifies SARVAM_API_KEY by calling Sarvam directly. Run with: pnpm tts:test
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const { VOICES } = await import("../src/lib/voices.ts");

const key = process.env.SARVAM_API_KEY;
if (!key) {
  console.error("SARVAM_API_KEY is not set. Add it to .env.local and run again.");
  process.exit(1);
}

const speaker = VOICES["hi-IN"][0]?.id;
if (!speaker) {
  console.error("No Hindi voice is configured in src/lib/voices.ts.");
  process.exit(1);
}

const codec = process.argv.includes("--wav") ? "wav" : "mp3";
const started = Date.now();
const res = await fetch("https://api.sarvam.ai/text-to-speech", {
  method: "POST",
  headers: { "api-subscription-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "अम्मा, नमस्ते। BP tablet का समय हो गया है।",
    language_code: "hi-IN",
    model: "bulbul:v4-flash",
    speaker,
    pace: 1.0,
    temperature: 0.6,
    speech_sample_rate: 22050,
    output_audio_codec: codec,
  }),
});
const json = await res.json().catch(() => ({}));
const requestId = json.request_id ?? json.error?.request_id ?? "none";

console.log(`status:     ${res.status}`);
console.log(`request_id: ${requestId}`);
console.log(`speaker:    ${speaker}`);
console.log(`time:       ${Date.now() - started} ms`);

if (!res.ok || !json.audios?.[0]) {
  console.error(`error:      ${json.error?.message ?? JSON.stringify(json).slice(0, 300)}`);
  process.exit(1);
}

const audio = Buffer.from(json.audios[0], "base64");
const dir = join(process.cwd(), ".tts-out");
await mkdir(dir, { recursive: true });
const file = join(dir, `out.${codec}`);
await writeFile(file, audio);
console.log(`size:       ${audio.length} bytes`);
console.log(`file:       ${file}`);
