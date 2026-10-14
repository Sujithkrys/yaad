import { route } from "@/lib/api";
import { getSettings, listCalls, listPeople, listReminders } from "@/lib/db/repo";
import { adherence, lastFinishedCall, minutesUsed, todayItems } from "@/lib/derive";
import type { Dashboard } from "@/lib/types";

export const GET = route(async ({ ws }): Promise<Dashboard> => {
  const now = Date.now();
  // 28 days covers the 14-day window plus the previous 14 for the change figure.
  const [people, reminders, calls, settings] = await Promise.all([
    listPeople(ws),
    listReminders(ws),
    listCalls(ws, { sinceDays: 31, limit: 2000 }),
    getSettings(ws),
  ]);
  return {
    now,
    todayItems: todayItems(reminders, people, calls, settings, now),
    adherence: {
      tablet: adherence(calls, people, "tablet", now),
      walk: adherence(calls, people, "walk", now),
      visit: adherence(calls, people, "visit", now),
    },
    lastCall: lastFinishedCall(calls),
    minutesUsed: minutesUsed(calls, now),
  };
});
