import { Prisma } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";

const familyFreezerItemSelect =
  Prisma.validator<Prisma.FamilyFreezerItemSelect>()({
    id: true,
    label: true,
    note: true,
    quantity: true,
  });

export type FamilyFreezerItemRow = Prisma.FamilyFreezerItemGetPayload<{
  select: typeof familyFreezerItemSelect;
}>;

export async function listFamilyFreezerItems({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const freezerItems = await db.familyFreezerItem.findMany({
    orderBy: [{ label: "asc" }],
    select: familyFreezerItemSelect,
    where: {
      familyId,
    },
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    freezerItems,
    userRole: membership.role,
  };
}

export async function listActiveFreezerItemsForPlanning({
  familyId,
  includeItemIds = [],
  userId,
}: {
  familyId: string;
  includeItemIds?: string[];
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const uniqueIncludeIds = [...new Set(includeItemIds.filter(Boolean))];

  return db.familyFreezerItem.findMany({
    orderBy: [{ label: "asc" }],
    select: familyFreezerItemSelect,
    where: {
      familyId,
      OR: [
        {
          quantity: {
            gt: 0,
          },
        },
        ...(uniqueIncludeIds.length > 0
          ? [
              {
                id: {
                  in: uniqueIncludeIds,
                },
              },
            ]
          : []),
      ],
    },
  });
}
