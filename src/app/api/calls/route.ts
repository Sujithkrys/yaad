import { ApiError, route } from "@/lib/api";
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

// Placing a call needs the Sarvam agent and the scheduler, which come later.
export const POST = route(async () => {
  throw new ApiError(501, "Calling is not connected yet.");
});
