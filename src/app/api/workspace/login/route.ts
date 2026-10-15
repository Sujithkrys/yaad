import { ApiError, errorResponse, readJson } from "@/lib/api";
import { loginInput } from "@/lib/auth/schemas";
import { clientIp, createRateLimiter } from "@/lib/server/rate-limit";
import { login } from "@/lib/workspace";

// Slows password guessing: per device, and per username from anywhere.
const perIp = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });
const perName = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  try {
    const { name, password } = loginInput.parse(await readJson(request));
    if (!perIp(clientIp(request)).ok || !perName(name.trim().toLowerCase()).ok) {
      throw new ApiError(429, "Too many login attempts. Wait a few minutes and try again.");
    }
    return Response.json({ workspace: await login(name, password) });
  } catch (err) {
    return errorResponse(err);
  }
}
