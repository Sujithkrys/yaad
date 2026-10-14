export type CallStatus = "confirmed" | "retry" | "calling" | "scheduled" | "missed";

export type ReminderKind = "tablet" | "walk" | "visit";
export type Repeat = "daily" | "weekdays" | "once";
export type Consent = "granted" | "pending";
export type Outcome = "taken" | "later" | "not_taken" | "no_answer";

/** 2 = taken on first ring, 1 = taken after retry, 0 = missed, -1 = not yet, -2 = no reminder that day */
export type DayResult = 2 | 1 | 0 | -1 | -2;

export type Person = {
  id: number;
  name: string;
  relation: string;
  phone: string;
  lang: string;
  consent: Consent;
  paused?: boolean;
};

export type Reminder = {
  id: number;
  personId: number;
  text: string;
  kind: ReminderKind;
  /** HH:MM, 24 hour */
  time: string;
  repeat: Repeat;
  /** YYYY-MM-DD, only for repeat "once" */
  onceDay?: string;
  active: boolean;
  /** YYYY-MM-DD; no calls are generated before this day */
  createdDay: string;
};

export type Settings = {
  retryMin: number;
  quietOn: boolean;
  quietFrom: string;
  quietTo: string;
  alertFamily: boolean;
  weeklySummary: boolean;
};

/** A call placed by hand with "Call now"; keyed by call id. */
export type ManualCall = { at: number };

export type AppState = {
  version: 1;
  user: { name: string };
  nextId: number;
  family: Person[];
  reminders: Reminder[];
  settings: Settings;
  manual: Record<string, ManualCall>;
};

export type TranscriptLine = { role: "agent" | "user"; native: string; english: string; at: string };

export type CallRecord = {
  id: string;
  day: string;
  person: Person;
  reminder: Reminder;
  scheduledTs: number;
  status: CallStatus;
  result: DayResult;
  outcome?: Outcome;
  /** Outcome of the first attempt when a retry was needed */
  firstOutcome?: Outcome;
  attempts: number;
  durationSec: number;
  answeredTs?: number;
  /** Short text for the dashboard row: "8:01 AM", "in 6 min", "ringing" */
  note: string;
};
