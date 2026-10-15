import { errorResponse } from "@/lib/api";
import { logout } from "@/lib/workspace";

export async function POST() {
  try {
    await logout();
    return Response.json({ workspace: null });
  } catch (err) {
    return errorResponse(err);
  }
}
