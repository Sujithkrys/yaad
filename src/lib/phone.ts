// Phone number helpers. Pure, safe on the client and the server.

/**
 * The 10 digits of an Indian mobile. Accepts the number with or without
 * +91, 91 or 0 in front; spaces, dashes, dots and brackets are ignored.
 * Returns null for anything else.
 */
export function mobileDigits(raw: string): string | null {
  const s = raw.trim().replace(/[\s\-().]/g, "");
  const m = /^(?:\+91|0091|91|0)?([6-9]\d{9})$/.exec(s);
  return m ? m[1] : null;
}

/** E.164 for an Indian mobile ("+919876543210"), or null. */
export function normalizePhone(raw: string): string | null {
  const d = mobileDigits(raw);
  return d ? `+91${d}` : null;
}

/**
 * E.164 for any number written in a config value. Indian numbers may be
 * written without +91; other numbers need their + and country code.
 */
export function toE164(raw: string): string | null {
  const india = normalizePhone(raw);
  if (india) return india;
  const s = raw.trim().replace(/[\s\-().]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}
