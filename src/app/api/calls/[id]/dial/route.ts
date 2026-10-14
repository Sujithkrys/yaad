import { route } from "@/lib/api";
import { dialCall } from "@/lib/calls/dial";

/** "Call again" from the call drawer. */
export const POST = route<{ id: string }>(async ({ workspace, params }) => dialCall(workspace, params.id, { manual: true }));
