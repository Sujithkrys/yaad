import { readJson, route } from "@/lib/api";
import { getSettings, putSettings } from "@/lib/db/repo";
import { settingsInput } from "@/lib/schemas";

export const GET = route(({ ws }) => getSettings(ws));

export const PUT = route(async ({ ws, request }) => {
  const patch = settingsInput.parse(await readJson(request));
  return putSettings(ws, patch);
});
