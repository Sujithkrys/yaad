// Shapes returned by the API (camelCase). Database rows are snake_case; see
// src/lib/db/mappers.ts. All ids are uuid strings.

export type Lang = "hi-IN" | "te-IN" | "ta-IN" | "kn-IN" | "en-IN";
export type ReminderKind = "tablet" | "walk" | "visit" | "other";
export type Repeat = "daily" | "weekdays" | "once";
export type Consent = "pending" | "granted";
/** Stored call states. */
export type CallState = "scheduled" | "calling" | "retry" | "confirmed" | "missed";
/** What the dashboard shows. A slot without a call row is also "scheduled". */
export type CallStatus = CallState;
export type Response = "taken" | "later" | "not_taken" | "no_answer" | "unclear";

/** 2 = taken on first ring, 1 = taken after retry, 0 = missed, -1 = not yet, -2 = no reminder that day */
export type DayResult = 2 | 1 | 0 | -1 | -2;

export type Person = {
  id: string;
  name: string;
  relation: string;
  phone: string;
  lang: Lang;
  consent: Consent;
  /** Added by "Load sample data"; never dialled for real. */
  isSample: boolean;
  createdAt: string;
};

export type Reminder = {
  id: string;
  personId: string;
  text: string;
  kind: ReminderKind;
  /** HH:MM, 24 hour, IST */
  time: string;
  repeat: Repeat;
  /** YYYY-MM-DD, only for repeat "once" */
  onceDay: string | null;
  active: boolean;
  /** Overrides the person's language when set */
  lang: Lang | null;
  createdAt: string;
};

export type TranscriptLine = { role: "agent" | "user"; native: string; english: string; at: string };

export type Call = {
  id: string;
  reminderId: string | null;
  personId: string;
  personName: string;
  kind: ReminderKind;
  text: string;
  lang: Lang;
  /** epoch ms */
  scheduledAt: number;
  status: CallState;
  attempt: number;
  response: Response | null;
  laterMin: number | null;
  durationSec: number | null;
  lines: TranscriptLine[];
  alerted: boolean;
  manual: boolean;
  doneAt: number | null;
  /** epoch ms of the next scheduled attempt, for retries */
  nextAttemptAt: number | null;
  failureReason: string | null;
  /** call_summary from the agent */
  responseNote: string | null;
  unwell: boolean;
};

export type Settings = {
  alert: boolean;
  alertChannel: "WhatsApp" | "SMS" | "Email";
  alertNumber: string;
  alertEmail: string;
  retryMin: 5 | 10 | 15;
  maxAttempts: number;
  quietOn: boolean;
  quietFrom: string;
  quietTo: string;
  defaultLang: Lang;
  demoOutcome: "random" | "taken" | "noanswer";
};

export type TodayItem = {
  /** reminderId:dayKey */
  key: string;
  reminderId: string;
  personId: string;
  personName: string;
  text: string;
  kind: ReminderKind;
  lang: Lang;
  scheduledAt: number;
  status: CallStatus;
  /** "8:01 AM", "in 6 min", "ringing" */
  note: string;
  callId: string | null;
};

export type AdherenceRow = { personId: string; name: string; cells: DayResult[]; pct: number | null };

export type Adherence = {
  rows: AdherenceRow[];
  /** IST day keys, oldest first */
  days: string[];
  first: number;
  retried: number;
  missed: number;
  total: number;
  pct: number;
  /** percentage points vs the previous period */
  delta: number;
  perDay: number[];
};

export type Dashboard = {
  now: number;
  todayItems: TodayItem[];
  adherence: Record<"tablet" | "walk" | "visit", Adherence>;
  lastCall: Call | null;
  minutesUsed: number;
};
