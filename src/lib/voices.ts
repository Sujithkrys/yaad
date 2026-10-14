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

/**
 * The one place to edit voices. Add a speaker as { id: "<name>_<lang>_<style>", label: "<Name>" }.
 * A language with no speakers stays selectable; the preview just can't play it yet.
 */
export const languageVoices: Record<LanguageCode, Voice[]> = {
  "hi-IN": [{ id: "ritu_hi_customer", label: "Ritu" }],
  "te-IN": [],
  "ta-IN": [],
  "kn-IN": [],
  "en-IN": [{ id: "simran_en_customer", label: "Simran" }],
};

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];

export const NO_VOICE_HINT = "No voice added yet";

export function isLanguageCode(code: string): code is LanguageCode {
  return (LANGUAGE_CODES as string[]).includes(code);
}

export function voicesFor(code: string): Voice[] {
  return isLanguageCode(code) ? languageVoices[code] : [];
}

export function isKnownSpeaker(code: string, speaker: string) {
  return voicesFor(code).some((v) => v.id === speaker);
}
