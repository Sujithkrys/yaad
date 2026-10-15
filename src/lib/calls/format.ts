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

/**
 * What to tell the family when Sarvam refuses or cannot take a call.
 * `status` is Sarvam's HTTP status (0 when it could not be reached) and
 * `body` its response, which never contains our API key.
 */
export function sarvamFailureMessage(status: number, body: string) {
  if (status === 0) return "Could not reach Sarvam. Try again in a few minutes.";
  if (status === 401 || status === 403) return "Sarvam rejected the API key. Check that SARVAM_API_KEY is a key from the Voice Agents dashboard.";
  if (status === 404) return "Sarvam could not find the agent. Check SARVAM_ORG_ID, SARVAM_WORKSPACE_ID, SARVAM_APP_ID and SARVAM_APP_VERSION.";
  if (status === 429) return "Sarvam is limiting calls right now. Try again in a minute.";
  if (status >= 500) return "Sarvam had a problem placing the call. Try again in a few minutes.";
  const detail = sarvamDetail(body);
  return `Sarvam refused the call${detail ? `: ${detail}` : ""}. Check the agent, connection and phone number settings.`;
}

/** The human part of a Sarvam error body: `detail`, `message` or `error`. */
function sarvamDetail(body: string): string {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return body.trim().slice(0, 160);
  }
  const o = (json ?? {}) as Record<string, unknown>;
  const d = o.detail ?? o.message ?? o.error;
  if (typeof d === "string") return d.slice(0, 160);
  // Validation errors: [{ loc: ["body", "user_config", "user_phone_number"], msg: "..." }]
  if (Array.isArray(d)) {
    return d
      .slice(0, 2)
      .map((x: { loc?: unknown[]; msg?: string }) => [Array.isArray(x.loc) ? x.loc.filter((p) => p !== "body").join(".") : "", x.msg].filter(Boolean).join(" "))
      .join("; ")
      .slice(0, 160);
  }
  return "";
}
