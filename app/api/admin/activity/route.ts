
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { userActivity } from "@/lib/db/schema";
import { requireAdmin } from "@/server/admin-auth";
import { apiError, json } from "@/server/api-utils";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);

    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const limit = limitParam === null ? 50 : Number(limitParam);
    const offset = offsetParam === null ? 0 : Number(offsetParam);

    if (
      !Number.isInteger(limit) ||
      !Number.isInteger(offset) ||
      limit < 1 ||
      limit > 100 ||
      offset < 0
    ) {
      return apiError(
        "Limit must be 1–100 and offset must be non-negative",
        400
      );
    }

    const activity = await db
      .select()
      .from(userActivity)
      .orderBy(desc(userActivity.createdAt))
      .limit(limit)
      .offset(offset);

    return json({ activity, limit, offset }, 200);
  } catch (error) {
    console.error("GET /api/admin/activity failed:", error);
    return apiError("Could not load activity", 500);
  }
}
