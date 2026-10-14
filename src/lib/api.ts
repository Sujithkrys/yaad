import "server-only";

import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { getWorkspaceId } from "./workspace";

/** An error whose message is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, `${what} was not found.`);

type PgError = { code?: string; message?: string; details?: string };

/** Turn a Supabase error into a plain sentence. Never leaks the raw database message. */
export function dbError(error: PgError, conflict = "That already exists."): ApiError {
  if (error.code === "23505") return new ApiError(409, conflict);
  if (error.code === "23503") return new ApiError(404, "A linked record was not found.");
  if (error.code === "23514" || error.code === "22P02" || error.code === "22007") return new ApiError(400, "Some details are not valid.");
  console.error("[db]", error.code, error.message);
  return new ApiError(500, "Something went wrong saving your changes. Try again.");
}

type Handler<C> = (ctx: { ws: string; request: Request; params: C }) => Promise<Response | unknown>;

/**
 * Wraps a route handler: resolves the visitor's workspace, returns JSON, and
 * maps every failure to { error: "<plain sentence>" } without stack traces.
 */
export function route<C = Record<string, never>>(handler: Handler<C>) {
  return async (request: Request, context: { params: Promise<C> }) => {
    try {
      const ws = await getWorkspaceId();
      const params = context?.params ? await context.params : ({} as C);
      const result = await handler({ ws, request, params });
      return result instanceof Response ? result : Response.json(result ?? { ok: true });
    } catch (err) {
      // Let Next.js handle its own control-flow errors (prerender bailouts and the like).
      unstable_rethrow(err);
      if (err instanceof ApiError) return Response.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        return Response.json({ error: err.issues[0]?.message ?? "The request is not valid." }, { status: 400 });
      }
      console.error("[api]", (err as Error).message);
      return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "The request body must be JSON.");
  }
}
