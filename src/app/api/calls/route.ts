import { z } from "zod";
import { readJson, route } from "@/lib/api";
import { callReminderNow } from "@/lib/calls/dial";
import { listCalls } from "@/lib/db/repo";
import { callsQuery } from "@/lib/schemas";

export const GET = route(async ({ ws, request }) => {
  const url = new URL(request.url);
  const { person, status, q } = callsQuery.parse(Object.fromEntries(url.searchParams));
  const calls = await listCalls(ws, { person, status, limit: q ? 500 : 200 });
  const needle = q?.toLowerCase();
  const filtered = needle
    ? calls.filter((c) => c.text.toLowerCase().includes(needle) || c.personName.toLowerCase().includes(needle))
    : calls;
  return filtered.slice(0, 200);
});

const callNowInput = z.object({ reminderId: z.uuid({ error: "Choose a reminder to call about." }) });

/** "Call now": dials today's call for a reminder. */
export const POST = route(async ({ workspace, request }) => {
  const { reminderId } = callNowInput.parse(await readJson(request));
  return callReminderNow(workspace, reminderId);
});
