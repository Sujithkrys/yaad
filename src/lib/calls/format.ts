// Pure helpers for placing calls. No I/O, safe to unit test.

import { renderGreeting } from "../greetings";

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

/**
 * E.164 for Indian mobiles. Accepts 10 digits, 0 + 10 digits, 91 + 10 digits
 * or +91 + 10 digits (spaces and dashes ignored). Returns null otherwise.
 */
export function normalizePhone(raw: string): string | null {
  const s = raw.trim().replace(/[\s-()]/g, "");
  const m = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(s);
  return m ? `+91${m[1]}` : null;
}

/** First words of the call, in the person's own language and script. */
export function openingLine(lang: string, personName: string, reminderText: string) {
  return renderGreeting(lang, personName, reminderText);
}
