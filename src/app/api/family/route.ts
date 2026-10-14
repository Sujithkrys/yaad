import { readJson, route } from "@/lib/api";
import { createPerson, listPeople } from "@/lib/db/repo";
import { personInput } from "@/lib/schemas";

export const GET = route(({ ws }) => listPeople(ws));

export const POST = route(async ({ ws, request }) => {
  const input = personInput.parse(await readJson(request));
  return createPerson(ws, input);
});
