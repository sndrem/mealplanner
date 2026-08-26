import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, sendEmailMock } = vi.hoisted(() => {
  return {
    dbMock: {
      family: {
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      mealPlan: {
        findMany: vi.fn(),
      },
    },
    sendEmailMock: vi.fn(),
  };
});

vi.mock("./db.server", () => {
  return {
    db: dbMock,
  };
});

vi.mock("./mailer.server", () => {
  return {
    sendEmail: sendEmailMock,
  };
});

import {
  buildWeekendPlanReminderEmail,
  getUnplannedWeekendDays,
  isCronAuthorizationValid,
  isDinnerEntryPlanned,
  isWeekendReminderWindow,
  runWeekendPlanReminders,
} from "./weekend-plan-reminder.server";

const THURSDAY_NOON_OSLO = new Date("2026-08-27T10:00:00.000Z");
const WEDNESDAY_NOON_OSLO = new Date("2026-08-26T10:00:00.000Z");
const WEEK_START = "2026-08-24";
const SATURDAY = "2026-08-29";
const SUNDAY = "2026-08-30";

function coveringPlan(entries: Array<{
  date: Date;
  freezerItemId: string | null;
  note: string | null;
  recipeId: string | null;
}>) {
  return {
    endDate: new Date(`${SUNDAY}T00:00:00.000Z`),
    entries,
    id: "plan-1",
    startDate: new Date(`${WEEK_START}T00:00:00.000Z`),
  };
}

function dinnerEntry({
  date,
  freezerItemId = null,
  note = null,
  recipeId = null,
}: {
  date: string;
  freezerItemId?: string | null;
  note?: string | null;
  recipeId?: string | null;
}) {
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    freezerItemId,
    note,
    recipeId,
  };
}

describe("weekend-plan-reminder.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.family.findMany.mockResolvedValue([]);
    dbMock.family.update.mockResolvedValue({});
    dbMock.family.updateMany.mockResolvedValue({ count: 0 });
    dbMock.mealPlan.findMany.mockResolvedValue([]);
    sendEmailMock.mockResolvedValue({ delivered: true });
  });

  it("detects Thursday 12:00 Europe/Oslo and ignores other hours", () => {
    expect(isWeekendReminderWindow(THURSDAY_NOON_OSLO)).toBe(true);
    expect(isWeekendReminderWindow(new Date("2026-08-27T10:59:00.000Z"))).toBe(
      true,
    );
    expect(isWeekendReminderWindow(new Date("2026-08-27T11:00:00.000Z"))).toBe(
      false,
    );
    expect(isWeekendReminderWindow(WEDNESDAY_NOON_OSLO)).toBe(false);
    expect(isWeekendReminderWindow(new Date("2026-01-08T11:00:00.000Z"))).toBe(
      true,
    );
  });

  it("compares cron secrets without leaking length", () => {
    expect(
      isCronAuthorizationValid({
        authorizationHeader: "Bearer super-secret",
        cronSecret: "super-secret",
      }),
    ).toBe(true);
    expect(
      isCronAuthorizationValid({
        authorizationHeader: "Bearer wrong-secret",
        cronSecret: "super-secret",
      }),
    ).toBe(false);
    expect(
      isCronAuthorizationValid({
        authorizationHeader: null,
        cronSecret: "super-secret",
      }),
    ).toBe(false);
  });

  it("treats recipe, freezer, or note as a planned dinner", () => {
    expect(isDinnerEntryPlanned({ recipeId: "recipe-1" })).toBe(true);
    expect(isDinnerEntryPlanned({ freezerItemId: "freezer-1" })).toBe(true);
    expect(isDinnerEntryPlanned({ note: "  Pizza  " })).toBe(true);
    expect(isDinnerEntryPlanned({ note: "   " })).toBe(false);
    expect(isDinnerEntryPlanned(null)).toBe(false);
  });

  it("returns Saturday when Sunday is planned with a recipe", async () => {
    dbMock.mealPlan.findMany.mockResolvedValue([
      coveringPlan([
        dinnerEntry({ date: SUNDAY, recipeId: "recipe-1" }),
      ]),
    ]);

    const result = await getUnplannedWeekendDays({
      familyId: "family-1",
      referenceDate: THURSDAY_NOON_OSLO,
    });

    expect(result.weekStart).toBe(WEEK_START);
    expect(result.unplannedDays.map((day) => day.date)).toEqual([SATURDAY]);
  });

  it("returns Sunday when Saturday is planned with a note", async () => {
    dbMock.mealPlan.findMany.mockResolvedValue([
      coveringPlan([dinnerEntry({ date: SATURDAY, note: "Takeaway" })]),
    ]);

    const result = await getUnplannedWeekendDays({
      familyId: "family-1",
      referenceDate: THURSDAY_NOON_OSLO,
    });

    expect(result.unplannedDays.map((day) => day.date)).toEqual([SUNDAY]);
  });

  it("returns both weekend days when there is no covering plan", async () => {
    const result = await getUnplannedWeekendDays({
      familyId: "family-1",
      referenceDate: THURSDAY_NOON_OSLO,
    });

    expect(result.unplannedDays.map((day) => day.date)).toEqual([
      SATURDAY,
      SUNDAY,
    ]);
  });

  it("returns no unplanned days when both weekend dinners are filled", async () => {
    dbMock.mealPlan.findMany.mockResolvedValue([
      coveringPlan([
        dinnerEntry({ date: SATURDAY, freezerItemId: "freezer-1" }),
        dinnerEntry({ date: SUNDAY, recipeId: "recipe-2" }),
      ]),
    ]);

    const result = await getUnplannedWeekendDays({
      familyId: "family-1",
      referenceDate: THURSDAY_NOON_OSLO,
    });

    expect(result.unplannedDays).toEqual([]);
  });

  it("builds a Norwegian reminder with the empty days and family link", () => {
    const message = buildWeekendPlanReminderEmail({
      familyName: "Solberg",
      familyUrl: "https://example.com/families/family-1",
      unplannedDays: [
        { date: SATURDAY, weekdayLabel: "lørdag" },
        { date: SUNDAY, weekdayLabel: "søndag" },
      ],
    });

    expect(message.subject).toBe("Helgen er ikke planlagt");
    expect(message.text).toContain("Solberg");
    expect(message.text).toContain("- Lørdag");
    expect(message.text).toContain("- Søndag");
    expect(message.text).toContain("https://example.com/families/family-1");
    expect(message.html).toContain("<li>Lørdag</li>");
  });

  it("skips sending outside the Thursday 12:00 window unless forced", async () => {
    await expect(
      runWeekendPlanReminders({
        now: WEDNESDAY_NOON_OSLO,
        origin: "https://example.com",
      }),
    ).resolves.toMatchObject({
      emailsSent: 0,
      skippedOutsideWindow: true,
      weekStart: WEEK_START,
    });
    expect(dbMock.family.findMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends to families with an unplanned weekend day and claims the week", async () => {
    dbMock.family.findMany.mockResolvedValue([
      {
        id: "family-1",
        name: "Solberg",
        reminderEmail: "familie@example.com",
        weekendReminderSentForWeek: null,
      },
    ]);
    dbMock.family.updateMany.mockResolvedValue({ count: 1 });

    const result = await runWeekendPlanReminders({
      now: THURSDAY_NOON_OSLO,
      origin: "https://example.com",
    });

    expect(dbMock.family.updateMany).toHaveBeenCalledWith({
      data: { weekendReminderSentForWeek: WEEK_START },
      where: {
        id: "family-1",
        OR: [
          { weekendReminderSentForWeek: null },
          { weekendReminderSentForWeek: { not: WEEK_START } },
        ],
      },
    });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Helgen er ikke planlagt",
        to: "familie@example.com",
        text: expect.stringContaining(
          "https://example.com/families/family-1",
        ),
      }),
    );
    expect(result).toMatchObject({
      emailsFailed: 0,
      emailsSent: 1,
      skippedClaimed: 0,
      skippedOutsideWindow: false,
      skippedPlanned: 0,
    });
  });

  it("does not send when both weekend days are planned", async () => {
    dbMock.family.findMany.mockResolvedValue([
      {
        id: "family-1",
        name: "Solberg",
        reminderEmail: "familie@example.com",
        weekendReminderSentForWeek: null,
      },
    ]);
    dbMock.mealPlan.findMany.mockResolvedValue([
      coveringPlan([
        dinnerEntry({ date: SATURDAY, recipeId: "recipe-1" }),
        dinnerEntry({ date: SUNDAY, note: "Pizza" }),
      ]),
    ]);

    const result = await runWeekendPlanReminders({
      force: true,
      now: WEDNESDAY_NOON_OSLO,
      origin: "https://example.com",
    });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(dbMock.family.updateMany).not.toHaveBeenCalled();
    expect(result.skippedPlanned).toBe(1);
    expect(result.emailsSent).toBe(0);
  });

  it("does not send a second email when the week is already claimed", async () => {
    dbMock.family.findMany.mockResolvedValue([
      {
        id: "family-1",
        name: "Solberg",
        reminderEmail: "familie@example.com",
        weekendReminderSentForWeek: WEEK_START,
      },
    ]);
    dbMock.family.updateMany.mockResolvedValue({ count: 0 });

    const result = await runWeekendPlanReminders({
      now: THURSDAY_NOON_OSLO,
      origin: "https://example.com",
    });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(result.skippedClaimed).toBe(1);
  });

  it("unclaims the week when email delivery fails", async () => {
    dbMock.family.findMany.mockResolvedValue([
      {
        id: "family-1",
        name: "Solberg",
        reminderEmail: "familie@example.com",
        weekendReminderSentForWeek: null,
      },
    ]);
    dbMock.family.updateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockResolvedValue({ delivered: false });

    const result = await runWeekendPlanReminders({
      now: THURSDAY_NOON_OSLO,
      origin: "https://example.com",
    });

    expect(dbMock.family.update).toHaveBeenCalledWith({
      data: { weekendReminderSentForWeek: null },
      where: { id: "family-1" },
    });
    expect(result.emailsFailed).toBe(1);
    expect(result.emailsSent).toBe(0);
  });

  it("only sends once when two runs race to claim the same week", async () => {
    dbMock.family.findMany.mockResolvedValue([
      {
        id: "family-1",
        name: "Solberg",
        reminderEmail: "familie@example.com",
        weekendReminderSentForWeek: null,
      },
    ]);
    let claimed = false;
    dbMock.family.updateMany.mockImplementation(async () => {
      if (claimed) {
        return { count: 0 };
      }

      claimed = true;
      return { count: 1 };
    });

    const [first, second] = await Promise.all([
      runWeekendPlanReminders({
        now: THURSDAY_NOON_OSLO,
        origin: "https://example.com",
      }),
      runWeekendPlanReminders({
        now: THURSDAY_NOON_OSLO,
        origin: "https://example.com",
      }),
    ]);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(first.emailsSent + second.emailsSent).toBe(1);
    expect(first.skippedClaimed + second.skippedClaimed).toBe(1);
  });
});
