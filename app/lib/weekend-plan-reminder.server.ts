import { createHash, timingSafeEqual } from "node:crypto";

import { MealType } from "@prisma/client";

import { db } from "./db.server";
import { sendEmail } from "./mailer.server";
import { formatDateOnly } from "./meal-plan-dates";
import { formatWeekdayLabel } from "./meal-plan-display";
import { LIVE_MEAL_PLAN_STATUS_FILTER } from "./meal-plan-status.server";
import {
  getCalendarWeekBounds,
  getCalendarWeekDates,
} from "./meal-plan-week";

export const WEEKEND_REMINDER_TIME_ZONE = "Europe/Oslo";
export const WEEKEND_REMINDER_WEEKDAY = "Thu";
export const WEEKEND_REMINDER_HOUR = 12;

type DinnerEntryFields = {
  date: Date;
  freezerItemId: string | null;
  note: string | null;
  recipeId: string | null;
};

export type UnplannedWeekendDay = {
  date: string;
  weekdayLabel: string;
};

export type WeekendDinnerPlanStatus = {
  unplannedDays: UnplannedWeekendDay[];
  weekStart: string;
};

export type WeekendPlanReminderRunResult = {
  emailsFailed: number;
  emailsSent: number;
  skippedClaimed: number;
  skippedOutsideWindow: boolean;
  skippedPlanned: number;
  weekStart: string;
};

export function isWeekendReminderWindow(
  now = new Date(),
  timeZone = WEEKEND_REMINDER_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone,
    weekday: "short",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);

  return weekday === WEEKEND_REMINDER_WEEKDAY && hour === WEEKEND_REMINDER_HOUR;
}

export function isCronAuthorizationValid({
  authorizationHeader,
  cronSecret,
}: {
  authorizationHeader: string | null;
  cronSecret: string;
}) {
  const provided = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length)
    : "";
  const left = createHash("sha256").update(provided).digest();
  const right = createHash("sha256").update(cronSecret).digest();

  return timingSafeEqual(left, right);
}

export function isDinnerEntryPlanned(
  entry:
    | {
        freezerItemId?: string | null;
        note?: string | null;
        recipeId?: string | null;
      }
    | null
    | undefined,
) {
  if (!entry) {
    return false;
  }

  return Boolean(entry.recipeId || entry.freezerItemId || entry.note?.trim());
}

export function buildWeekendPlanReminderEmail({
  familyName,
  familyUrl,
  unplannedDays,
}: {
  familyName: string;
  familyUrl: string;
  unplannedDays: UnplannedWeekendDay[];
}) {
  const dayList = unplannedDays
    .map((day) => `- ${capitalizeLabel(day.weekdayLabel)}`)
    .join("\n");
  const dayHtml = unplannedDays
    .map((day) => `<li>${escapeHtml(capitalizeLabel(day.weekdayLabel))}</li>`)
    .join("");
  const subject = "Helgen er ikke planlagt";
  const text = [
    "Hei,",
    "",
    `Lørdag eller søndag mangler middag i ukeplanen for ${familyName}.`,
    "",
    "Ikke planlagt:",
    dayList,
    "",
    "Åpne familieoversikten og fyll inn helgen:",
    familyUrl,
  ].join("\n");
  const html = [
    "<p>Hei,</p>",
    `<p>Lørdag eller søndag mangler middag i ukeplanen for ${escapeHtml(familyName)}.</p>`,
    "<p>Ikke planlagt:</p>",
    `<ul>${dayHtml}</ul>`,
    `<p><a href="${escapeHtml(familyUrl)}">Åpne familieoversikten</a></p>`,
  ].join("");

  return { html, subject, text };
}

export async function getUnplannedWeekendDays({
  familyId,
  referenceDate = new Date(),
}: {
  familyId: string;
  referenceDate?: Date;
}): Promise<WeekendDinnerPlanStatus> {
  const weekBounds = getCalendarWeekBounds(
    referenceDate,
    WEEKEND_REMINDER_TIME_ZONE,
  );
  const weekDates = getCalendarWeekDates(weekBounds);
  const saturday = weekDates[5];
  const sunday = weekDates[6];
  const weekendDates = [saturday, sunday].filter(
    (date): date is string => Boolean(date),
  );
  const weekStartDate = new Date(`${weekBounds.weekStart}T00:00:00.000Z`);
  const weekEndDate = new Date(`${weekBounds.weekEnd}T00:00:00.000Z`);

  const mealPlans = await db.mealPlan.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      endDate: true,
      entries: {
        select: {
          date: true,
          freezerItemId: true,
          note: true,
          recipeId: true,
        },
        where: {
          mealType: MealType.DINNER,
        },
      },
      id: true,
      startDate: true,
    },
    where: {
      endDate: {
        gte: weekStartDate,
      },
      familyId,
      startDate: {
        lte: weekEndDate,
      },
      status: LIVE_MEAL_PLAN_STATUS_FILTER,
    },
  });

  const unplannedDays = weekendDates.flatMap((date) => {
    const coveringPlan = mealPlans.find(
      (plan) =>
        formatDateOnly(plan.startDate) <= date &&
        formatDateOnly(plan.endDate) >= date,
    );
    const dinnerEntry = coveringPlan?.entries.find(
      (entry: DinnerEntryFields) => formatDateOnly(entry.date) === date,
    );

    if (isDinnerEntryPlanned(dinnerEntry)) {
      return [];
    }

    return [
      {
        date,
        weekdayLabel: formatWeekdayLabel(date),
      } satisfies UnplannedWeekendDay,
    ];
  });

  return {
    unplannedDays,
    weekStart: weekBounds.weekStart,
  };
}

export async function runWeekendPlanReminders({
  force = false,
  now = new Date(),
  origin,
}: {
  force?: boolean;
  now?: Date;
  origin: string;
}): Promise<WeekendPlanReminderRunResult> {
  const weekStart = getCalendarWeekBounds(
    now,
    WEEKEND_REMINDER_TIME_ZONE,
  ).weekStart;
  const emptyResult: WeekendPlanReminderRunResult = {
    emailsFailed: 0,
    emailsSent: 0,
    skippedClaimed: 0,
    skippedOutsideWindow: false,
    skippedPlanned: 0,
    weekStart,
  };

  if (!force && !isWeekendReminderWindow(now)) {
    return {
      ...emptyResult,
      skippedOutsideWindow: true,
    };
  }

  const families = await db.family.findMany({
    select: {
      id: true,
      name: true,
      reminderEmail: true,
      weekendReminderSentForWeek: true,
    },
    where: {
      reminderEmail: {
        not: null,
      },
    },
  });

  const result = { ...emptyResult };

  for (const family of families) {
    if (!family.reminderEmail) {
      continue;
    }

    const weekend = await getUnplannedWeekendDays({
      familyId: family.id,
      referenceDate: now,
    });

    if (weekend.unplannedDays.length === 0) {
      result.skippedPlanned += 1;
      continue;
    }

    const claimed = await db.family.updateMany({
      data: {
        weekendReminderSentForWeek: weekStart,
      },
      where: {
        id: family.id,
        OR: [
          { weekendReminderSentForWeek: null },
          { weekendReminderSentForWeek: { not: weekStart } },
        ],
      },
    });

    if (claimed.count !== 1) {
      result.skippedClaimed += 1;
      continue;
    }

    const familyUrl = `${origin}/families/${family.id}`;
    const message = buildWeekendPlanReminderEmail({
      familyName: family.name,
      familyUrl,
      unplannedDays: weekend.unplannedDays,
    });
    const sendResult = await sendEmail({
      to: family.reminderEmail,
      ...message,
    });

    if (!sendResult.delivered) {
      await db.family.update({
        data: {
          weekendReminderSentForWeek: family.weekendReminderSentForWeek,
        },
        where: { id: family.id },
      });
      result.emailsFailed += 1;
      continue;
    }

    result.emailsSent += 1;
  }

  return result;
}

function capitalizeLabel(value: string) {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
