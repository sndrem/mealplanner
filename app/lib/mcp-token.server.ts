import { createHash, randomBytes } from "node:crypto";
import { FamilyRole } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyAdmin } from "./family.server";

export function hashFamilyMcpToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createFamilyMcpRawToken() {
  return randomBytes(32).toString("hex");
}

export function buildFamilyMcpUrl(origin: string) {
  return `${origin.replace(/\/+$/, "")}/mcp`;
}

export function buildFamilyMealPlanProposalUrl({
  familyId,
  mealPlanId,
  origin,
}: {
  familyId: string;
  mealPlanId: string;
  origin: string;
}) {
  return `${origin.replace(/\/+$/, "")}/families/${familyId}/meal-plans/${mealPlanId}/proposal`;
}

function parseBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

export async function getFamilyMcpTokenStatus({
  familyId,
}: {
  familyId: string;
}) {
  const token = await db.familyMcpToken.findUnique({
    select: {
      id: true,
    },
    where: {
      familyId,
    },
  });

  return {
    exists: Boolean(token),
  };
}

export async function createOrRotateFamilyMcpToken({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const token = createFamilyMcpRawToken();
  const tokenHash = hashFamilyMcpToken(token);

  await db.$transaction(async (tx) => {
    await tx.familyMcpToken.deleteMany({
      where: {
        familyId,
      },
    });
    await tx.familyMcpToken.create({
      data: {
        createdByUserId: userId,
        familyId,
        tokenHash,
      },
    });
  });

  return {
    token,
  };
}

export async function revokeFamilyMcpToken({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  await db.familyMcpToken.deleteMany({
    where: {
      familyId,
    },
  });
}

async function resolveMcpActorUserId({
  createdByUserId,
  familyId,
}: {
  createdByUserId: string | null;
  familyId: string;
}) {
  if (createdByUserId) {
    const creatorMembership = await db.familyMembership.findUnique({
      select: {
        userId: true,
      },
      where: {
        familyId_userId: {
          familyId,
          userId: createdByUserId,
        },
      },
    });

    if (creatorMembership) {
      return creatorMembership.userId;
    }
  }

  const adminMembership = await db.familyMembership.findFirst({
    orderBy: [{ createdAt: "asc" }],
    select: {
      userId: true,
    },
    where: {
      familyId,
      role: FamilyRole.ADMIN,
    },
  });

  return adminMembership?.userId ?? null;
}

export async function resolveFamilyMcpAuth(authorizationHeader: string | null) {
  const rawToken = parseBearerToken(authorizationHeader);

  if (!rawToken) {
    return null;
  }

  const token = await db.familyMcpToken.findUnique({
    select: {
      createdByUserId: true,
      familyId: true,
      id: true,
    },
    where: {
      tokenHash: hashFamilyMcpToken(rawToken),
    },
  });

  if (!token) {
    return null;
  }

  const userId = await resolveMcpActorUserId({
    createdByUserId: token.createdByUserId,
    familyId: token.familyId,
  });

  if (!userId) {
    return null;
  }

  await db.familyMcpToken.update({
    data: {
      lastUsedAt: new Date(),
    },
    where: {
      id: token.id,
    },
  });

  return {
    familyId: token.familyId,
    userId,
  };
}
