import { db } from "@/lib/db";
import { userActivity } from "@/lib/db/schema";
import { monitorFailedLogins } from "@/server/security-monitor";
import { apiError, json } from "@/server/api-utils";

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");

    // Use the first forwarded IP, or the real IP if available.
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || null;

    if (!ipAddress) {
      return apiError("Could not determine client IP", 400);
    }

    // Record the failed login attempt.
    await db.insert(userActivity).values({
      userId: null,
      action: "login_failed",
      description: "A login attempt failed",
      ipAddress,
      userAgent: request.headers.get("user-agent"),
      metadata: {},
    });

    // Check for repeated failed attempts from this IP.
    const monitoring = await monitorFailedLogins(ipAddress);

    return json(
      {
        message: "Failed login activity recorded",
        monitoring,
      },
      201
    );
  } catch (error) {
    console.error("Record failed login:", error);

    return apiError("Could not record failed login", 500);
  }
}
