import { randomInt } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { db } from "./db.server";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;
const MAX_JOIN_CODE_ATTEMPTS = 10;
const familySummarySelect = {
  id: true,
  name: true,
};

const familyMembershipSelect = {
  id: true,
  familyId: true,
  role: true,
  userId: true,
  family: {
    select: {
      id: true,
      joinCode: true,
      name: true,
    },
  },
};

const familyMemberSelect = {
  id: true,
  role: true,
  user: {
    select: {
      displayName: true,
      email: true,
      id: true,
    },
  },
};

export async function getFamilyMembershipsForUser(userId: string) {
  return db.familyMembership.findMany({
    where: { userId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      family: {
        select: familySummarySelect,
      },
    },
  });
}

export async function getFamilyMembershipForUser({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  return db.familyMembership.findUnique({
    where: {
      familyId_userId: {
        familyId,
        userId,
      },
    },
    select: familyMembershipSelect,
  });
}

export async function requireFamilyMembership(input: { familyId: string; userId: string }) {
  const membership = await getFamilyMembershipForUser(input);

  if (!membership) {
    throw new Response("Fant ikke familien.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return membership;
}

export async function requireFamilyAdmin(input: { familyId: string; userId: string }) {
  const membership = await requireFamilyMembership(input);

  if (membership.role !== "ADMIN") {
    throw new Response("Du har ikke tilgang til å administrere denne familien.", {
      status: 403,
      statusText: "Forbidden",
    });
  }

  return membership;
}

export async function listFamilyMembers(familyId: string) {
  return db.familyMembership.findMany({
    where: { familyId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: familyMemberSelect,
  });
}

export async function createFamilyForUser({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const joinCode = await generateUniqueJoinCode();

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const family = await tx.family.create({
      data: {
        name: name.trim(),
        joinCode,
        createdByUserId: userId,
      },
      select: {
        id: true,
        name: true,
        joinCode: true,
      },
    });

    await tx.familyMembership.create({
      data: {
        familyId: family.id,
        userId,
        role: "ADMIN",
      },
    });

    return family;
  });
}

export async function joinFamilyByCode({
  userId,
  joinCode,
}: {
  userId: string;
  joinCode: string;
}) {
  const normalizedJoinCode = joinCode.trim().toUpperCase();
  const family = await db.family.findUnique({
    where: { joinCode: normalizedJoinCode },
    select: {
      id: true,
      name: true,
      joinCode: true,
    },
  });

  if (!family) {
    return { status: "NOT_FOUND" as const };
  }

  const existingMembership = await db.familyMembership.findUnique({
    where: {
      familyId_userId: {
        familyId: family.id,
        userId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingMembership) {
    return {
      status: "ALREADY_MEMBER" as const,
      family,
    };
  }

  await db.familyMembership.create({
    data: {
      familyId: family.id,
      userId,
      role: "MEMBER",
    },
  });

  return {
    status: "JOINED" as const,
    family,
  };
}

export async function removeFamilyMember({
  familyId,
  actorUserId,
  targetUserId,
}: {
  familyId: string;
  actorUserId: string;
  targetUserId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId: actorUserId,
  });

  const targetMembership = await db.familyMembership.findUnique({
    where: {
      familyId_userId: {
        familyId,
        userId: targetUserId,
      },
    },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          displayName: true,
          id: true,
        },
      },
    },
  });

  if (!targetMembership) {
    return { status: "NOT_FOUND" as const };
  }

  if (targetMembership.user.id === actorUserId) {
    return { status: "CANNOT_REMOVE_SELF" as const };
  }

  if (targetMembership.role !== "MEMBER") {
    return { status: "CANNOT_REMOVE_ADMIN" as const };
  }

  await db.familyMembership.delete({
    where: { id: targetMembership.id },
  });

  return {
    status: "REMOVED" as const,
    removedUser: targetMembership.user,
  };
}

function generateJoinCodeCandidate() {
  return Array.from({ length: JOIN_CODE_LENGTH }, () => {
    const randomIndex = randomInt(0, JOIN_CODE_ALPHABET.length);

    return JOIN_CODE_ALPHABET[randomIndex];
  }).join("");
}

async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt += 1) {
    const joinCode = generateJoinCodeCandidate();
    const existingFamily = await db.family.findUnique({
      where: { joinCode },
      select: { id: true },
    });

    if (!existingFamily) {
      return joinCode;
    }
  }

  throw new Error("Klarte ikke å opprette en unik familiekode.");
}
