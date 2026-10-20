
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socAlerts } from "@/lib/db/schema";
import { requireAdmin } from "@/server/admin-auth";
import { apiError, json } from "@/server/api-utils";

const validStatuses = ["new", "acknowledged", "resolved"] as const;

type AlertStatus = (typeof validStatuses)[number];

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);

    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    if (
      status &&
      !validStatuses.includes(status as AlertStatus)
    ) {
      return apiError("Invalid alert status", 400);
    }

    const alerts = await db
      .select()
      .from(socAlerts)
      .where(
        status
          ? eq(socAlerts.status, status as AlertStatus)
          : undefined
      )
      .orderBy(desc(socAlerts.createdAt));

    return json({ alerts }, 200);
  } catch (error) {
    console.error("GET /api/admin/alerts failed:", error);
    return apiError("Could not load alerts", 500);
  }
}
