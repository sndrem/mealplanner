import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { formatDateOnly } from "./meal-plan-dates";
import { getNextCalendarWeekBounds, getTodayDateOnly } from "./meal-plan-week";
import {
  parseStoreOfferBriefingText,
  resolveStoreOfferBriefingWeek,
  type StoreOfferBriefingRecord,
} from "./store-offer-briefing";

type BriefingActor = {
  familyId: string;
  userId: string;
};

export async function publishStoreOfferBriefing({
  content,
  familyId,
  subtitle,
  title,
  userId,
  weekEnd,
  weekStart,
}: BriefingActor & {
  content: string;
  subtitle: string;
  title: string;
  weekEnd?: string;
  weekStart?: string;
}) {
  await requireFamilyMembership({ familyId, userId });

  const text = parseStoreOfferBriefingText({ content, subtitle, title });

  if (!text.ok) {
    return {
      formError: text.formError,
      status: "VALIDATION_ERROR" as const,
    };
  }

  const week = resolveStoreOfferBriefingWeek({ weekEnd, weekStart });

  if (!week.ok) {
    return {
      formError: week.formError,
      status: "VALIDATION_ERROR" as const,
    };
  }

  const row = await db.storeOfferBriefing.upsert({
    create: {
      content: text.content,
      familyId,
      publishedByUserId: userId,
      subtitle: text.subtitle,
      title: text.title,
      weekEnd: dateOnlyToUtcDate(week.weekEnd),
      weekStart: dateOnlyToUtcDate(week.weekStart),
    },
    update: {
      content: text.content,
      publishedByUserId: userId,
      subtitle: text.subtitle,
      title: text.title,
      weekEnd: dateOnlyToUtcDate(week.weekEnd),
    },
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: dateOnlyToUtcDate(week.weekStart),
      },
    },
  });

  return {
    briefingId: row.id,
    status: "PUBLISHED" as const,
    weekEnd: week.weekEnd,
    weekStart: week.weekStart,
  };
}

export async function getStoreOfferBriefing({
  familyId,
  userId,
  weekEnd,
  weekStart,
}: BriefingActor & {
  weekEnd?: string;
  weekStart?: string;
}) {
  await requireFamilyMembership({ familyId, userId });

  const week = resolveStoreOfferBriefingWeek({ weekEnd, weekStart });

  if (!week.ok) {
    return {
      formError: week.formError,
      status: "VALIDATION_ERROR" as const,
    };
  }

  const row = await db.storeOfferBriefing.findUnique({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: dateOnlyToUtcDate(week.weekStart),
      },
    },
  });

  if (!row) {
    return {
      briefing: null,
      status: "EMPTY" as const,
      weekEnd: week.weekEnd,
      weekStart: week.weekStart,
    };
  }

  return {
    briefing: serializeStoreOfferBriefing(row),
    status: "FOUND" as const,
    weekEnd: week.weekEnd,
    weekStart: week.weekStart,
  };
}

export async function listStoreOfferBriefingsForStoreMode({
  familyId,
  focusedDates,
  userId,
}: BriefingActor & {
  focusedDates: string[];
}) {
  await requireFamilyMembership({ familyId, userId });

  const today = dateOnlyToUtcDate(getTodayDateOnly());
  const nextWeek = getNextCalendarWeekBounds();
  const focusedSpan = getFocusedSpan(focusedDates);
  const filters = [
    { weekEnd: { gte: today } },
    { weekStart: dateOnlyToUtcDate(nextWeek.weekStart) },
    ...(focusedSpan
      ? [
          {
            weekEnd: { gte: dateOnlyToUtcDate(focusedSpan.start) },
            weekStart: { lte: dateOnlyToUtcDate(focusedSpan.end) },
          },
        ]
      : []),
  ];

  const rows = await db.storeOfferBriefing.findMany({
    orderBy: [{ weekStart: "asc" }, { id: "asc" }],
    where: {
      OR: filters,
      familyId,
    },
  });

  return rows.map(serializeStoreOfferBriefing);
}

function serializeStoreOfferBriefing(row: {
  content: string;
  id: string;
  subtitle: string;
  title: string;
  updatedAt: Date;
  weekEnd: Date;
  weekStart: Date;
}): StoreOfferBriefingRecord {
  return {
    content: row.content,
    id: row.id,
    subtitle: row.subtitle,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    weekEnd: formatDateOnly(row.weekEnd),
    weekStart: formatDateOnly(row.weekStart),
  };
}

function getFocusedSpan(focusedDates: string[]) {
  if (focusedDates.length === 0) {
    return null;
  }

  const sorted = [...focusedDates].sort();

  return {
    end: sorted[sorted.length - 1]!,
    start: sorted[0]!,
  };
}

function dateOnlyToUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
