import { dayKey, startOfDay } from "./time";
import type { AppState } from "./types";

export const STORAGE_KEY = "yaad-app-v1";

/** Sample family and reminders. History is derived from these, see calls.ts. */
export function seedState(now: number): AppState {
  const created = dayKey(startOfDay(now, -40));
  const today = dayKey(now);
  return {
    version: 1,
    user: { name: "Pavan" },
    nextId: 100,
    family: [
      { id: 1, name: "Amma", relation: "Mother", phone: "9876500011", lang: "te-IN", consent: "granted" },
      { id: 2, name: "Nanna", relation: "Father", phone: "9876500012", lang: "te-IN", consent: "granted" },
      { id: 3, name: "Dadi", relation: "Grandmother", phone: "9876500013", lang: "hi-IN", consent: "granted" },
      { id: 4, name: "Paati", relation: "Grandmother", phone: "9876500014", lang: "ta-IN", consent: "granted" },
      { id: 5, name: "Mama", relation: "Other", phone: "9876500015", lang: "kn-IN", consent: "pending" },
    ],
    reminders: [
      { id: 1, personId: 3, text: "Morning tablet", kind: "tablet", time: "08:00", repeat: "daily", active: true, createdDay: created },
      { id: 2, personId: 1, text: "BP tablet", kind: "tablet", time: "08:30", repeat: "daily", active: true, createdDay: created },
      { id: 3, personId: 2, text: "Sugar tablet", kind: "tablet", time: "13:30", repeat: "daily", active: true, createdDay: created },
      { id: 4, personId: 3, text: "Evening walk", kind: "walk", time: "18:00", repeat: "daily", active: true, createdDay: created },
      { id: 5, personId: 1, text: "BP tablet", kind: "tablet", time: "19:00", repeat: "daily", active: true, createdDay: created },
      { id: 6, personId: 4, text: "Thyroid tablet", kind: "tablet", time: "07:30", repeat: "daily", active: true, createdDay: created },
      { id: 7, personId: 2, text: "Morning walk", kind: "walk", time: "06:30", repeat: "weekdays", active: true, createdDay: created },
      { id: 8, personId: 4, text: "Doctor visit", kind: "visit", time: "21:00", repeat: "once", onceDay: today, active: true, createdDay: created },
      { id: 9, personId: 1, text: "Eye drops", kind: "tablet", time: "21:30", repeat: "daily", active: false, createdDay: created },
    ],
    settings: {
      retryMin: 10,
      quietOn: true,
      quietFrom: "22:00",
      quietTo: "06:00",
      alertFamily: true,
      weeklySummary: true,
    },
    manual: {},
  };
}

/** How reliably each sample person answers; new people default to 0.9. */
export const RELIABILITY: Record<number, number> = { 1: 0.95, 2: 0.88, 3: 0.7, 4: 0.9 };
