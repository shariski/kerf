import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { keyboardProfiles, sessions, users } from "./db/schema";
import type { JourneyCode } from "#/domain/adaptive/journey";
import { toJourneyCode } from "#/domain/adaptive/journey";

export type SettingsData = {
  account: {
    email: string;
    displayName: string | null;
    createdAt: string;
  };
  totalSessions: number;
  activeProfile: {
    id: string;
    keyboardType: string;
    fingerAssignment: JourneyCode;
  };
  profiles: Array<{
    id: string;
    keyboardType: string;
    sessionCount: number;
    isActive: boolean;
  }>;
};

export const getAccountSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<SettingsData> => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect({ to: "/login" });

    const userId = session.user.id;

    const [userRow] = await db
      .select({
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow) throw redirect({ to: "/login" });

    const profileRows = await db
      .select()
      .from(keyboardProfiles)
      .where(eq(keyboardProfiles.userId, userId));

    if (profileRows.length === 0) throw redirect({ to: "/onboarding" });

    const active = profileRows.find((p) => p.isActive);
    if (!active) throw redirect({ to: "/onboarding" });

    const perProfileCounts = await db
      .select({
        profileId: sessions.keyboardProfileId,
        n: count(),
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNotNull(sessions.keyboardProfileId)))
      .groupBy(sessions.keyboardProfileId);

    const countMap = new Map<string, number>();
    for (const row of perProfileCounts) {
      if (row.profileId) countMap.set(row.profileId, Number(row.n));
    }
    const totalSessions = perProfileCounts.reduce((sum, r) => sum + Number(r.n), 0);

    return {
      account: {
        email: userRow.email,
        displayName: userRow.name ?? null,
        createdAt: userRow.createdAt.toISOString(),
      },
      totalSessions,
      activeProfile: {
        id: active.id,
        keyboardType: active.keyboardType,
        fingerAssignment: toJourneyCode(active.fingerAssignment),
      },
      profiles: profileRows
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((p) => ({
          id: p.id,
          keyboardType: p.keyboardType,
          sessionCount: countMap.get(p.id) ?? 0,
          isActive: p.isActive,
        })),
    };
  },
);
