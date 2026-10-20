import "server-only";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  userActivity,
  socAlerts,
  socIncidents,
  auditLogs,
} from "@/lib/db/schema";

const LOGIN_WINDOW_MINUTES = 5;
const LOGIN_THRESHOLD = 5;

const FAILED_LOGIN_WINDOW_MINUTES = 5;
const FAILED_LOGIN_THRESHOLD = 5;

const ACTIVE_ALERT_STATUSES = ["new", "acknowledged"] as const;

// ========================================
// MONITOR SUCCESSFUL LOGINS
// ========================================

export async function monitorSuccessfulLogins(userId: string) {
  return db.transaction(async (tx) => {
    // Serialize monitoring for this user.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`
    );

    const since = new Date(
      Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000
    );

    const [result] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(userActivity)
      .where(
        and(
          eq(userActivity.userId, userId),
          eq(userActivity.action, "login_success"),
          gte(userActivity.createdAt, since)
        )
      );

    if (Number(result?.count ?? 0) < LOGIN_THRESHOLD) {
      return {
        alertCreated: false,
        reason: "threshold_not_reached",
      };
    }

    const [existingAlert] = await tx
      .select({ id: socAlerts.id })
      .from(socAlerts)
      .where(
        and(
          eq(socAlerts.userId, userId),
          eq(socAlerts.source, "login_monitor"),
          inArray(socAlerts.status, [...ACTIVE_ALERT_STATUSES])
        )
      )
      .limit(1);

    if (existingAlert) {
      return {
        alertCreated: false,
        reason: "alert_already_exists",
      };
    }

    const title = "Unusually frequent successful logins";
    const description =
      `The user signed in at least ${LOGIN_THRESHOLD} times ` +
      `within ${LOGIN_WINDOW_MINUTES} minutes.`;

    const [alert] = await tx
      .insert(socAlerts)
      .values({
        userId,
        title,
        description,
        severity: "medium",
        status: "new",
        source: "login_monitor",
        metadata: {
          event: "frequent_successful_logins",
          windowMinutes: LOGIN_WINDOW_MINUTES,
          threshold: LOGIN_THRESHOLD,
        },
      })
      .returning();

    const [incident] = await tx
      .insert(socIncidents)
      .values({
        alertId: alert.id,
        title,
        description,
        severity: alert.severity,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorId: userId,
      action: "soc_incident_auto_created",
      resourceType: "soc_incident",
      resourceId: incident.id,
      details: {
        alertId: alert.id,
        reason: "frequent_successful_logins",
      },
    });

    return {
      alertCreated: true,
      alertId: alert.id,
      incidentId: incident.id,
    };
  });
}

// ========================================
// MONITOR FAILED LOGINS
// ========================================

export async function monitorFailedLogins(ipAddress: string) {
  const normalizedIp = ipAddress.trim();

  if (!normalizedIp) {
    return {
      alertCreated: false,
      reason: "missing_ip_address",
    };
  }

  return db.transaction(async (tx) => {
    // Serialize monitoring for this IP address.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(
        hashtext(${`failed-login:${normalizedIp}`})::bigint
      )`
    );

    const since = new Date(
      Date.now() - FAILED_LOGIN_WINDOW_MINUTES * 60 * 1000
    );

    const [result] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(userActivity)
      .where(
        and(
          eq(userActivity.action, "login_failed"),
          eq(userActivity.ipAddress, normalizedIp),
          gte(userActivity.createdAt, since)
        )
      );

    if (Number(result?.count ?? 0) < FAILED_LOGIN_THRESHOLD) {
      return {
        alertCreated: false,
        reason: "threshold_not_reached",
      };
    }

    const [existingAlert] = await tx
      .select({ id: socAlerts.id })
      .from(socAlerts)
      .where(
        and(
          eq(socAlerts.source, "login_failure_monitor"),
          inArray(socAlerts.status, [...ACTIVE_ALERT_STATUSES]),
          sql`${socAlerts.metadata}->>'ipAddress' = ${normalizedIp}`
        )
      )
      .limit(1);

    if (existingAlert) {
      return {
        alertCreated: false,
        reason: "alert_already_exists",
      };
    }

    const title = "Repeated failed login attempts";
    const description =
      `At least ${FAILED_LOGIN_THRESHOLD} failed login attempts were ` +
      `recorded from the same IP address within ` +
      `${FAILED_LOGIN_WINDOW_MINUTES} minutes.`;

    const [alert] = await tx
      .insert(socAlerts)
      .values({
        userId: null,
        title,
        description,
        severity: "high",
        status: "new",
        source: "login_failure_monitor",
        metadata: {
          event: "repeated_failed_logins",
          ipAddress: normalizedIp,
          windowMinutes: FAILED_LOGIN_WINDOW_MINUTES,
          threshold: FAILED_LOGIN_THRESHOLD,
        },
      })
      .returning();

    const [incident] = await tx
      .insert(socIncidents)
      .values({
        alertId: alert.id,
        title,
        description,
        severity: alert.severity,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorId: null,
      action: "soc_incident_auto_created",
      resourceType: "soc_incident",
      resourceId: incident.id,
      ipAddress: normalizedIp,
      details: {
        alertId: alert.id,
        reason: "repeated_failed_logins",
      },
    });

    return {
      alertCreated: true,
      alertId: alert.id,
      incidentId: incident.id,
    };
  });
}
