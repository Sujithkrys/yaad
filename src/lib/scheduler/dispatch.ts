// Step B: dial calls that are due. Each row is claimed atomically, so two
// overlapping ticks can never dial the same call.

export const DISPATCH_LIMIT = 5;

export type DueCall = { id: string; status: "scheduled" | "retry"; workspaceId: string; workspaceName: string };

export type DispatchDeps = {
  listDue: (limit: number) => Promise<DueCall[]>;
  /** UPDATE calls SET status='calling' WHERE id=$1 AND status=$2 RETURNING. True when this caller won. */
  claim: (call: DueCall) => Promise<boolean>;
  dial: (call: DueCall) => Promise<void>;
};

export async function dispatchDue(deps: DispatchDeps) {
  const due = await deps.listDue(DISPATCH_LIMIT);
  const claimed: DueCall[] = [];
  for (const c of due) if (await deps.claim(c)) claimed.push(c);

  // One failure never stops the batch.
  const results = await Promise.allSettled(claimed.map((c) => deps.dial(c)));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error("[scheduler] dial failed", claimed[i].id.slice(0, 8), (r.reason as Error)?.message);
  });
  return results.filter((r) => r.status === "fulfilled").length;
}
