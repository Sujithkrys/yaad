import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api";
import { claimWorkspace, currentWorkspace, renameWorkspace, requireWorkspace } from "@/lib/workspace";

const nameInput = z.object({
  name: z
    .string({ error: "Write your name." })
    .trim()
    .min(2, "Names need at least 2 characters.")
    .max(40, "Names can be up to 40 characters.")
    .regex(/^[\p{L}\p{M}\p{N} .'-]+$/u, "Use letters, numbers, spaces, dots or dashes."),
});

/** { workspace: { id, name } } or { workspace: null } when this browser has none yet. */
export async function GET() {
  try {
    return Response.json({ workspace: await currentWorkspace() });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Claim a unique name and create this browser's workspace. */
export async function POST(request: Request) {
  try {
    const { name } = nameInput.parse(await readJson(request));
    return Response.json({ workspace: await claimWorkspace(name) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Rename this browser's workspace. */
export async function PATCH(request: Request) {
  try {
    const ws = await requireWorkspace();
    const { name } = nameInput.parse(await readJson(request));
    return Response.json({ workspace: await renameWorkspace(ws.id, name) });
  } catch (err) {
    return errorResponse(err);
  }
}
