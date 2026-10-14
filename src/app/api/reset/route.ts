import { route } from "@/lib/api";
import { resetWorkspace } from "@/lib/db/repo";

export const POST = route(async ({ ws }) => {
  await resetWorkspace(ws);
  return { ok: true };
});
