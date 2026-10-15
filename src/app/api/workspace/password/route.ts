import { errorResponse, readJson } from "@/lib/api";
import { passwordChange } from "@/lib/auth/schemas";
import { requireWorkspace, setPassword } from "@/lib/workspace";

/** Set a password (accounts made before passwords) or change it (needs the current one). */
export async function POST(request: Request) {
  try {
    const ws = await requireWorkspace();
    const { current, password } = passwordChange.parse(await readJson(request));
    return Response.json({ workspace: await setPassword(ws, current, password) });
  } catch (err) {
    return errorResponse(err);
  }
}
