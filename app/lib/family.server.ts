import { randomInt } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { db } from "./db.server";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;
const MAX_JOIN_CODE_ATTEMPTS = 10;

export async function getFamilyMembershipsForUser(userId: string) {
  return db.familyMembership.findMany({
    where: { userId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      family: {
        select: {
          id: true,
          name: true,
          joinCode: true,
        },
      },
    },
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

  throw new Error("Klarte ikke a opprette en unik familiekode.");
}
