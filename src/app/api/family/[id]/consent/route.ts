import { readJson, route } from "@/lib/api";
import { updatePerson } from "@/lib/db/repo";
import { consentInput } from "@/lib/schemas";

// Temporary: marks consent by hand until real SMS replies exist.
export const POST = route<{ id: string }>(async ({ ws, request, params }) => {
  const { status } = consentInput.parse(await readJson(request));
  return updatePerson(ws, params.id, { consent: status });
});
