import { z } from "zod";
import { ApiError, errorResponse, readJson } from "@/lib/api";
import { credentials, username } from "@/lib/auth/schemas";
import { clientIp, createRateLimiter } from "@/lib/server/rate-limit";
import { createAccount, currentWorkspace, renameWorkspace, requireWorkspace } from "@/lib/workspace";

const signupLimit = createRateLimiter({ limit: 10, windowMs: 60 * 60_000 });

/** { workspace: { id, name, hasPassword } } or { workspace: null } when not logged in. */
export async function GET() {
  try {
    return Response.json({ workspace: await currentWorkspace() });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create an account (unique username + password) and log this browser in. */
export async function POST(request: Request) {
  try {
    // Production only, so local test runs can create many accounts.
    if (process.env.NODE_ENV === "production" && !signupLimit(clientIp(request)).ok) {
      throw new ApiError(429, "Too many new accounts from this device. Try again later.");
    }
    const { name, password } = credentials.parse(await readJson(request));
    return Response.json({ workspace: await createAccount(name, password) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Rename the account. The new username must also be free. */
export async function PATCH(request: Request) {
  try {
    const ws = await requireWorkspace();
    const { name } = z.object({ name: username }).parse(await readJson(request));
    return Response.json({ workspace: await renameWorkspace(ws, name) });
  } catch (err) {
    return errorResponse(err);
  }
}
