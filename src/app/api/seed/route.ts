import { route } from "@/lib/api";
import { getSettings } from "@/lib/db/repo";
import { seedWorkspace } from "@/lib/db/seed";

export const POST = route(async ({ ws }) => seedWorkspace(ws, await getSettings(ws)));
