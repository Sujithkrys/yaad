import { readJson, route } from "@/lib/api";
import { deletePerson, updatePerson } from "@/lib/db/repo";
import { personPatch } from "@/lib/schemas";

type Params = { id: string };

export const PATCH = route<Params>(async ({ ws, request, params }) => {
  const patch = personPatch.parse(await readJson(request));
  return updatePerson(ws, params.id, patch);
});

// Reminders and calls go with the person through the foreign keys.
export const DELETE = route<Params>(async ({ ws, params }) => {
  await deletePerson(ws, params.id);
  return { ok: true };
});
