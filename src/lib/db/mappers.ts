import type { Call, Person, Reminder, Settings, TranscriptLine } from "@/lib/types";

// snake_case database rows <-> camelCase API shapes.

export type PersonRow = {
  id: string;
  workspace_id: string;
  name: string;
  relation: string;
  phone: string;
  lang: Person["lang"];
  consent: Person["consent"];
  is_sample?: boolean;
  created_at: string;
};

export type ReminderRow = {
  id: string;
  workspace_id: string;
  person_id: string;
  reminder_text: string;
  kind: Reminder["kind"];
  time_of_day: string;
  repeat_rule: Reminder["repeat"];
  once_day: string | null;
  active: boolean;
  lang: Reminder["lang"];
  created_at: string;
};

export type CallRow = {
  id: string;
  workspace_id: string;
  reminder_id: string | null;
  person_id: string;
  kind: Call["kind"];
  reminder_text: string;
  lang: Call["lang"];
  scheduled_at: string;
  status: Call["status"];
  attempt: number;
  response: Call["response"];
  later_min: number | null;
  duration_sec: number | null;
  lines: TranscriptLine[];
  alerted: boolean;
  manual: boolean;
  done_at: string | null;
  next_attempt_at?: string | null;
  failure_reason?: string | null;
  response_note?: string | null;
  unwell?: boolean;
  people?: { name: string } | null;
};

export type SettingsRow = {
  workspace_id: string;
  alert: boolean;
  alert_channel: Settings["alertChannel"];
  alert_number: string;
  alert_email?: string;
  retry_min: Settings["retryMin"];
  max_attempts: number;
  quiet_on: boolean;
  quiet_from: string;
  quiet_to: string;
  default_lang: Settings["defaultLang"];
  demo_outcome: Settings["demoOutcome"];
};

export const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  name: r.name,
  relation: r.relation,
  phone: r.phone,
  lang: r.lang,
  consent: r.consent,
  isSample: r.is_sample ?? false,
  createdAt: r.created_at,
});

export const toReminder = (r: ReminderRow): Reminder => ({
  id: r.id,
  personId: r.person_id,
  text: r.reminder_text,
  kind: r.kind,
  time: r.time_of_day,
  repeat: r.repeat_rule,
  onceDay: r.once_day,
  active: r.active,
  lang: r.lang,
  createdAt: r.created_at,
});

export const toCall = (r: CallRow): Call => ({
  id: r.id,
  reminderId: r.reminder_id,
  personId: r.person_id,
  personName: r.people?.name ?? "",
  kind: r.kind,
  text: r.reminder_text,
  lang: r.lang,
  scheduledAt: new Date(r.scheduled_at).getTime(),
  status: r.status,
  attempt: r.attempt,
  response: r.response,
  laterMin: r.later_min,
  durationSec: r.duration_sec,
  lines: Array.isArray(r.lines) ? r.lines : [],
  alerted: r.alerted,
  manual: r.manual,
  doneAt: r.done_at ? new Date(r.done_at).getTime() : null,
  nextAttemptAt: r.next_attempt_at ? new Date(r.next_attempt_at).getTime() : null,
  failureReason: r.failure_reason ?? null,
  responseNote: r.response_note ?? null,
  unwell: r.unwell ?? false,
});

export const toSettings = (r: SettingsRow): Settings => ({
  alert: r.alert,
  alertChannel: r.alert_channel,
  alertNumber: r.alert_number,
  alertEmail: r.alert_email ?? "",
  retryMin: r.retry_min,
  maxAttempts: r.max_attempts,
  quietOn: r.quiet_on,
  quietFrom: r.quiet_from,
  quietTo: r.quiet_to,
  defaultLang: r.default_lang,
  demoOutcome: r.demo_outcome,
});

/** Partial camelCase settings to a snake_case patch. */
export function settingsPatch(s: Partial<Settings>) {
  const map: Record<keyof Settings, keyof SettingsRow> = {
    alert: "alert",
    alertChannel: "alert_channel",
    alertNumber: "alert_number",
    alertEmail: "alert_email",
    retryMin: "retry_min",
    maxAttempts: "max_attempts",
    quietOn: "quiet_on",
    quietFrom: "quiet_from",
    quietTo: "quiet_to",
    defaultLang: "default_lang",
    demoOutcome: "demo_outcome",
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (v !== undefined) out[map[k as keyof Settings]] = v;
  return out;
}
