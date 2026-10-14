// All dates in Yaad are India time. Vercel runs in UTC, so never use the
// runtime's local time: read parts through Intl with timeZone Asia/Kolkata.

export const TZ = "Asia/Kolkata";
export const MINUTE = 60_000;
export const DAY = 86_400_000;
/** IST has no daylight saving: always UTC+05:30. */
const IST_OFFSET_MS = 330 * MINUTE;

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function istParts(ts: number): Parts {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFmt.formatToParts(ts)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAY_INDEX[p.weekday],
  };
}

export function nowIST() {
  return Date.now();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD of the IST calendar day containing `ts`. */
export function dayKeyIST(ts: number) {
  const p = istParts(ts);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Epoch ms of HH:MM on the given IST day. */
export function istDateAt(dayKey: string, hhmm: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h, min) - IST_OFFSET_MS;
}

/** Day key `offset` days from the IST day containing `ts`. */
export function addDaysIST(ts: number, offset: number) {
  return dayKeyIST(istDateAt(dayKeyIST(ts), "12:00") + offset * DAY);
}

export function weekdayOfDayKey(dayKey: string) {
  return istParts(istDateAt(dayKey, "12:00")).weekday;
}

export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "HH:MM" in IST for `ts`. */
export function hhmmIST(ts: number) {
  const p = istParts(ts);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/* ---------- formatting (always IST) ---------- */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function fmtClock(h: number, m: number) {
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtHHMM(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return fmtClock(h, m);
}

export function fmtTs(ts: number) {
  const p = istParts(ts);
  return fmtClock(p.hour, p.minute);
}

export function fmtDate(ts: number) {
  const p = istParts(ts);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}`;
}

export function fmtDayKey(dayKey: string) {
  return fmtDate(istDateAt(dayKey, "12:00"));
}

export function fmtShortDayKey(dayKey: string) {
  const [, m, d] = dayKey.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function fmtLongDate(ts: number) {
  const p = istParts(ts);
  return `${WEEKDAYS_LONG[p.weekday]} ${p.day} ${MONTHS_LONG[p.month - 1]}`;
}

/** "in 6 min", "in 1h 58m" */
export function fmtIn(ms: number) {
  const min = Math.max(1, Math.round(ms / MINUTE));
  if (min < 60) return `in ${min} min`;
  return `in ${Math.floor(min / 60)}h ${min % 60}m`;
}

export function fmtDuration(sec: number | null | undefined) {
  if (!sec) return "–";
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}

export function greetingWord(ts: number) {
  const h = istParts(ts).hour;
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

/** Day key for a one-off reminder: today if the time is still ahead in IST, otherwise tomorrow. */
export function nextOnceDay(hhmm: string, now = Date.now()) {
  const today = dayKeyIST(now);
  return istDateAt(today, hhmm) > now ? today : addDaysIST(now, 1);
}
