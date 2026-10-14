import { readJson, route } from "@/lib/api";
import { createReminder, listReminders } from "@/lib/db/repo";
import { reminderInput } from "@/lib/schemas";

export const GET = route(({ ws }) => listReminders(ws));

export const POST = route(async ({ ws, request }) => {
  const input = reminderInput.parse(await readJson(request));
  return createReminder(ws, { ...input, onceDay: input.repeat === "once" ? (input.onceDay ?? null) : null, lang: input.lang ?? null });
});
