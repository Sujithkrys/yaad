// Languages and Sarvam Bulbul v4 flash speakers.
// Speaker IDs are lowercase and case-sensitive: <name>_<language>_<style>.
// Kept free of imports so scripts/tts-test.mjs can load it directly.

export const LANGUAGES = [
  { code: "hi-IN", label: "Hindi" },
  { code: "te-IN", label: "Telugu" },
  { code: "ta-IN", label: "Tamil" },
  { code: "kn-IN", label: "Kannada" },
  { code: "en-IN", label: "English" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export type Voice = { id: string; label: string };

export const VOICES: Record<LanguageCode, Voice[]> = {
  "hi-IN": [{ id: "ritu_hi_customer", label: "Ritu" }],
  // TODO: add Telugu speaker IDs from Sarvam's voice catalog.
  "te-IN": [],
  // TODO: add Tamil speaker IDs from Sarvam's voice catalog.
  "ta-IN": [],
  // TODO: add Kannada speaker IDs from Sarvam's voice catalog.
  "kn-IN": [],
  "en-IN": [{ id: "simran_en_customer", label: "Simran" }],
};

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];

export const NO_VOICE_HINT = "No voice added yet";

export function isLanguageCode(code: string): code is LanguageCode {
  return (LANGUAGE_CODES as string[]).includes(code);
}

export function voicesFor(code: string): Voice[] {
  return isLanguageCode(code) ? VOICES[code] : [];
}

export function isKnownSpeaker(code: string, speaker: string) {
  return voicesFor(code).some((v) => v.id === speaker);
}
