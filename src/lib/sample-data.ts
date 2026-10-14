// Hard-coded sample data for the dashboard. Replace with real data later.

export type CallStatus = "confirmed" | "retry" | "calling" | "scheduled";

export type Call = {
  id: number;
  who: string;
  what: string;
  lang: string;
  h: number;
  m: number;
  status: CallStatus;
  note: string;
};

export type ReminderKind = "tablet" | "walk" | "visit";

/** 2 = taken on first ring, 1 = taken after retry, 0 = missed, -1 = not yet */
export type DayResult = 2 | 1 | 0 | -1;

export type TranscriptLine = {
  speaker: "agent" | "parent";
  native: string;
  english: string;
  at: string;
};

export const user = {
  name: "Pavan",
  initial: "P",
  role: "Owner",
  familyCount: 4,
};

export const today = {
  greeting: "Good evening, Pavan",
  dateLine: "Wednesday 14 October",
  /** 7:02 PM in the sample day */
  nowMinutes: 19 * 60 + 2,
};

export const usage = { used: 212, limit: 300 };

export const RETRY_AFTER_MIN = 10;

export const calls: Call[] = [
  { id: 1, who: "Dadi", what: "Morning tablet", lang: "Hindi", h: 8, m: 0, status: "confirmed", note: "8:01 AM" },
  { id: 2, who: "Amma", what: "BP tablet", lang: "Telugu", h: 8, m: 30, status: "confirmed", note: "8:31 AM" },
  { id: 3, who: "Nanna", what: "Sugar tablet", lang: "Telugu", h: 13, m: 30, status: "confirmed", note: "1:32 PM" },
  { id: 4, who: "Dadi", what: "Evening walk", lang: "Hindi", h: 18, m: 0, status: "retry", note: "in 6 min" },
  { id: 5, who: "Amma", what: "BP tablet", lang: "Telugu", h: 19, m: 0, status: "calling", note: "ringing" },
  { id: 6, who: "Paati", what: "Doctor visit", lang: "Tamil", h: 21, m: 0, status: "scheduled", note: "in 1h 58m" },
];

export const INITIAL_SELECTED_CALL = 5;

export const people = [
  { name: "Amma", rate: 0.95 },
  { name: "Nanna", rate: 0.88 },
  { name: "Dadi", rate: 0.7 },
  { name: "Paati", rate: 0.91 },
];

export const ADHERENCE_DAYS = 14;
export const adherenceDelta = "3.1%";
export const lastSynced = "7:02 PM";

/** Deterministic PRNG (mulberry32) so server and client render the same grid. */
export function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildAdherence(kind: ReminderKind): Record<string, DayResult[]> {
  const offset = { tablet: 1, walk: 7, visit: 13 }[kind];
  const r = rng(offset * 97 + 11);
  const out: Record<string, DayResult[]> = {};
  for (const p of people) {
    const bias = kind === "walk" ? p.rate - 0.12 : kind === "visit" ? p.rate - 0.05 : p.rate;
    const days: DayResult[] = [];
    for (let d = 0; d < ADHERENCE_DAYS; d++) {
      const v = r();
      days.push(v < bias * 0.78 ? 2 : v < bias ? 1 : 0);
    }
    const lastToday: Record<string, DayResult> = { Amma: -1, Nanna: 2, Dadi: -1, Paati: -1 };
    days[ADHERENCE_DAYS - 1] = kind === "tablet" ? lastToday[p.name] ?? -1 : -1;
    out[p.name] = days;
  }
  if (kind === "tablet") {
    // Two missed days in a row, then another
    out.Dadi[5] = 0;
    out.Dadi[6] = 0;
    out.Dadi[11] = 0;
  }
  return out;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day index 0 is 1 October 2026. */
export function adherenceDate(d: number) {
  const dt = new Date(2026, 9, 1 + d);
  return `${WEEKDAYS[dt.getDay()]} ${dt.getDate()} Oct`;
}

export const adherenceAxis = ["1 Oct", "7 Oct", "14 Oct"];

export const lastCall = {
  seconds: 38,
  who: "Amma",
  what: "BP tablet",
  model: "bulbul-v4-flash",
  outcome: "Confirmed",
  footnote: "no alert sent to family",
  langCode: "te",
  transcript: [
    { speaker: "agent", native: "అమ్మా, ఏడు అయింది. BP మాత్ర వేసుకున్నారా?", english: "Amma, it's seven. Did you take your BP tablet?", at: "0:02" },
    { speaker: "parent", native: "ఇంకా లేదు, ఇప్పుడే వేసుకుంటాను.", english: "Not yet, I'll take it now.", at: "0:11" },
    { speaker: "agent", native: "సరే అమ్మా, రెండు నిమిషాల్లో మళ్ళీ అడుగుతాను.", english: "Okay, I'll ask again in two minutes.", at: "0:19" },
    { speaker: "parent", native: "వేసుకున్నాను.", english: "Taken.", at: "0:34" },
  ] satisfies TranscriptLine[],
};

/** Waveform bars for the last call: "a" = agent speaking, "b" = parent speaking. */
export function buildWaveform(bars = 64) {
  const r = rng(5);
  return Array.from({ length: bars }, (_, i) => {
    const sec = (i / bars) * lastCall.seconds;
    const who: "a" | "b" | "" =
      sec < 9 || (sec > 17 && sec < 30) ? "a" : (sec > 10 && sec < 17) || sec > 31 ? "b" : "";
    return { who, height: who ? 8 + Math.round(r() * 24) : 4 };
  });
}
