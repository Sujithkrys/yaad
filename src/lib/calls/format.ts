// Pure helpers for placing calls. No I/O, safe to unit test.

import { renderGreeting } from "../greetings";

export { normalizePhone } from "../phone";

const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  kn: "Kannada",
  en: "English",
  ml: "Malayalam",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
};

/** "te-IN" or "te" -> "Telugu". Unknown codes fall back to Hindi. */
export function languageName(code: string) {
  return LANGUAGE_NAMES[code.split("-")[0].toLowerCase()] ?? "Hindi";
}

/** First words of the call, in the person's own language and script. */
export function openingLine(lang: string, personName: string, reminderText: string) {
  return renderGreeting(lang, personName, reminderText);
}
