import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  randomBytesMock,
  requireFamilyAdminMock,
} = vi.hoisted(() => {
  const calendarSubscription = {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  };

  return {
    dbMock: {
      $transaction: vi.fn(),
      calendarSubscription,
      mealPlan: {
        findMany: vi.fn(),
      },
    },
    randomBytesMock: vi.fn(),
    requireFamilyAdminMock: vi.fn(),
  };
});

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyAdmin: requireFamilyAdminMock,
  requireFamilyMembership: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();

  return {
    ...actual,
    randomBytes: randomBytesMock,
  };
});

import {
  buildCalendarSubscriptionUrls,
  createOrRotateFamilyCalendarSubscription,
  getFamilyCalendarFeedByToken,
  getFamilyCalendarSubscriptionStatus,
  hashCalendarSubscriptionToken,
  revokeFamilyCalendarSubscription,
} from "./calendar-subscription.server";

const RAW_TOKEN = "a".repeat(64);
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");
const PREVIOUS_TOKEN_HASH = createHash("sha256").update("b".repeat(64)).digest("hex");

const mockAdmin = {
  family: {
    id: "family-1",
    joinCode: "ABC123",
    name: "Solberg",
  },
  familyId: "family-1",
  id: "membership-1",
  role: "ADMIN",
  userId: "user-1",
};

function dinnerEntry({
  date,
  recipeTitle,
  updatedAt = new Date("2026-05-13T18:00:00.000Z"),
}: {
  date: string;
  recipeTitle: string;
  updatedAt?: Date;
}) {
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    freezerItem: null,
    freezerItemId: null,
    recipe: {
      description: `${recipeTitle} beskrivelse`,
      title: recipeTitle,
    },
    recipeId: `recipe-${recipeTitle}`,
    updatedAt,
  };
}

describe("calendar-subscription.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-14T09:30:45.000Z"));
    requireFamilyAdminMock.mockResolvedValue(mockAdmin);
    randomBytesMock.mockReturnValue(Buffer.from(RAW_TOKEN, "hex"));
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => unknown) => {
      return callback(dbMock);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hashes subscription tokens with SHA-256", () => {
    expect(hashCalendarSubscriptionToken(RAW_TOKEN)).toBe(TOKEN_HASH);
  });

  it("builds https and webcal subscribe URLs", () => {
    expect(
      buildCalendarSubscriptionUrls({
        origin: "https://mealplanner.example/",
        token: RAW_TOKEN,
      }),
    ).toEqual({
      httpsUrl: `https://mealplanner.example/c/${RAW_TOKEN}/calendar.ics`,
      webcalUrl: `webcal://mealplanner.example/c/${RAW_TOKEN}/calendar.ics`,
    });
  });

  it("stores a hashed token and returns the raw token once", async () => {
    dbMock.calendarSubscription.deleteMany.mockResolvedValue({ count: 0 });
    dbMock.calendarSubscription.create.mockResolvedValue({ id: "sub-1" });

    const result = await createOrRotateFamilyCalendarSubscription({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(requireFamilyAdminMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result).toEqual({ token: RAW_TOKEN });
    expect(dbMock.calendarSubscription.deleteMany).toHaveBeenCalledWith({
      where: { familyId: "family-1" },
    });
    expect(dbMock.calendarSubscription.create).toHaveBeenCalledWith({
      data: {
        createdByUserId: "user-1",
        familyId: "family-1",
        tokenHash: TOKEN_HASH,
      },
    });
  });

  it("replaces an existing token hash on rotate", async () => {
    dbMock.calendarSubscription.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.calendarSubscription.create.mockResolvedValue({ id: "sub-2" });

    await createOrRotateFamilyCalendarSubscription({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(dbMock.calendarSubscription.deleteMany).toHaveBeenCalled();
    expect(dbMock.calendarSubscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: TOKEN_HASH,
      }),
    });
    expect(TOKEN_HASH).not.toBe(PREVIOUS_TOKEN_HASH);
  });

  it("revokes the family subscription", async () => {
    dbMock.calendarSubscription.deleteMany.mockResolvedValue({ count: 1 });

    await revokeFamilyCalendarSubscription({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(requireFamilyAdminMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(dbMock.calendarSubscription.deleteMany).toHaveBeenCalledWith({
      where: { familyId: "family-1" },
    });
  });

  it("reports whether a subscription exists", async () => {
    dbMock.calendarSubscription.findUnique.mockResolvedValue({ id: "sub-1" });

    await expect(
      getFamilyCalendarSubscriptionStatus({ familyId: "family-1" }),
    ).resolves.toEqual({ exists: true });

    dbMock.calendarSubscription.findUnique.mockResolvedValue(null);

    await expect(
      getFamilyCalendarSubscriptionStatus({ familyId: "family-1" }),
    ).resolves.toEqual({ exists: false });
  });

  it("returns null for an unknown feed token", async () => {
    dbMock.calendarSubscription.findUnique.mockResolvedValue(null);

    await expect(getFamilyCalendarFeedByToken("missing")).resolves.toBeNull();
  });

  it("returns an empty calendar when nothing is planned", async () => {
    dbMock.calendarSubscription.findUnique.mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      familyId: "family-1",
    });
    dbMock.mealPlan.findMany.mockResolvedValue([]);

    const result = await getFamilyCalendarFeedByToken(RAW_TOKEN);

    expect(result).not.toBeNull();
    expect(result?.content).toContain("X-WR-CALNAME:Mealplanner - Solberg");
    expect(result?.content).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(result?.content).not.toContain("BEGIN:VEVENT");
    expect(result?.content).toContain("BEGIN:VTIMEZONE");
  });

  it("emits dinners from current and next week using the newest covering plan", async () => {
    dbMock.calendarSubscription.findUnique.mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      familyId: "family-1",
    });
    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        endDate: new Date("2026-05-17T00:00:00.000Z"),
        entries: [
          dinnerEntry({
            date: "2026-05-15",
            recipeTitle: "Pizza",
            updatedAt: new Date("2026-05-14T08:00:00.000Z"),
          }),
        ],
        id: "meal-plan-new",
        startDate: new Date("2026-05-11T00:00:00.000Z"),
        title: "Uke 20 ny",
      },
      {
        endDate: new Date("2026-05-17T00:00:00.000Z"),
        entries: [
          dinnerEntry({
            date: "2026-05-15",
            recipeTitle: "Taco",
          }),
        ],
        id: "meal-plan-old",
        startDate: new Date("2026-05-11T00:00:00.000Z"),
        title: "Uke 20 gammel",
      },
      {
        endDate: new Date("2026-05-24T00:00:00.000Z"),
        entries: [
          dinnerEntry({
            date: "2026-05-20",
            recipeTitle: "Lapskaus",
          }),
        ],
        id: "meal-plan-next",
        startDate: new Date("2026-05-18T00:00:00.000Z"),
        title: "Uke 21",
      },
    ]);

    const result = await getFamilyCalendarFeedByToken(RAW_TOKEN);

    expect(dbMock.calendarSubscription.findUnique).toHaveBeenCalledWith({
      select: {
        family: {
          select: {
            id: true,
            name: true,
          },
        },
        familyId: true,
      },
      where: {
        tokenHash: TOKEN_HASH,
      },
    });
    expect(dbMock.mealPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          endDate: {
            gte: new Date("2026-05-11T00:00:00.000Z"),
          },
          familyId: "family-1",
          startDate: {
            lte: new Date("2026-05-24T00:00:00.000Z"),
          },
        },
      }),
    );
    expect(result?.content).toContain("SUMMARY:Middag: Pizza");
    expect(result?.content).not.toContain("SUMMARY:Middag: Taco");
    expect(result?.content).toContain("SUMMARY:Middag: Lapskaus");
    expect(result?.content).toContain("UID:meal-plan-new-2026-05-15@mealplanner");
    expect(result?.content).toContain("UID:meal-plan-next-2026-05-20@mealplanner");
    expect(result?.content).toContain("LAST-MODIFIED:20260514T080000Z");
    expect(result?.content).toContain("DTSTAMP:20260514T080000Z");
  });

  it("keeps the same UID when a dinner recipe is swapped", async () => {
    dbMock.calendarSubscription.findUnique.mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      familyId: "family-1",
    });
    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        endDate: new Date("2026-05-17T00:00:00.000Z"),
        entries: [
          dinnerEntry({
            date: "2026-05-15",
            recipeTitle: "Taco",
            updatedAt: new Date("2026-05-12T10:00:00.000Z"),
          }),
        ],
        id: "meal-plan-1",
        startDate: new Date("2026-05-11T00:00:00.000Z"),
        title: "Uke 20",
      },
    ]);

    const first = await getFamilyCalendarFeedByToken(RAW_TOKEN);

    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        endDate: new Date("2026-05-17T00:00:00.000Z"),
        entries: [
          dinnerEntry({
            date: "2026-05-15",
            recipeTitle: "Fiskekaker",
            updatedAt: new Date("2026-05-14T08:00:00.000Z"),
          }),
        ],
        id: "meal-plan-1",
        startDate: new Date("2026-05-11T00:00:00.000Z"),
        title: "Uke 20",
      },
    ]);

    const second = await getFamilyCalendarFeedByToken(RAW_TOKEN);

    expect(first?.content).toContain("UID:meal-plan-1-2026-05-15@mealplanner");
    expect(second?.content).toContain("UID:meal-plan-1-2026-05-15@mealplanner");
    expect(second?.content).toContain("SUMMARY:Middag: Fiskekaker");
    expect(first?.content).toContain("SUMMARY:Middag: Taco");
  });
});
