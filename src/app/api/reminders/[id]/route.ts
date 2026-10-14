import { readJson, route } from "@/lib/api";
import { deleteReminder, updateReminder } from "@/lib/db/repo";
import { reminderPatch } from "@/lib/schemas";

type Params = { id: string };

export const PATCH = route<Params>(async ({ ws, request, params }) => {
  const patch = reminderPatch.parse(await readJson(request));
  if (patch.repeat && patch.repeat !== "once") patch.onceDay = null;
  return updateReminder(ws, params.id, patch);
});

export const DELETE = route<Params>(async ({ ws, params }) => {
  await deleteReminder(ws, params.id);
  return { ok: true };
});
