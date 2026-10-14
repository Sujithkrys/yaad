const pad = (n: number) => (n < 10 ? "0" : "") + n;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MINUTE = 60_000;
export const DAY = 86_400_000;

export function dayKey(ts: number | Date) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of the day `offset` days from `ts`. */
export function startOfDay(ts: number, offset = 0) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.getTime();
}

export function atTime(dayStart: number, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(dayStart);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export function fmtClock(h: number, m: number) {
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtTs(ts: number) {
  const d = new Date(ts);
  return fmtClock(d.getHours(), d.getMinutes());
}

export function fmtHHMM(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return fmtClock(h, m);
}

export function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtShortDate(ts: number) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtLongDate(ts: number) {
  const d = new Date(ts);
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

/** "in 6 min", "in 1h 58m" */
export function fmtIn(ms: number) {
  const min = Math.max(1, Math.round(ms / MINUTE));
  if (min < 60) return `in ${min} min`;
  return `in ${Math.floor(min / 60)}h ${min % 60}m`;
}

export function fmtDuration(sec: number) {
  if (!sec) return "–";
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}

export function greetingWord(ts: number) {
  const h = new Date(ts).getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function inQuietHours(hhmm: string, quiet: { quietOn: boolean; quietFrom: string; quietTo: string }) {
  if (!quiet.quietOn) return false;
  const m = minutesOf(hhmm);
  const a = minutesOf(quiet.quietFrom);
  const b = minutesOf(quiet.quietTo);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

/** Day key for a one-off reminder: today if the time is still ahead, otherwise tomorrow. */
export function nextOnceDay(hhmm: string, now = Date.now()) {
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  return dayKey(startOfDay(now, minutesOf(hhmm) <= nowMin ? 1 : 0));
}
