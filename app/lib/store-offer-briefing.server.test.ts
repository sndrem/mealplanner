import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => ({
  dbMock: {
    storeOfferBriefing: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  requireFamilyMembershipMock: vi.fn(),
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyMembership: requireFamilyMembershipMock,
}));

import { getNextCalendarWeekBounds } from "./meal-plan-week";
import {
  getStoreOfferBriefing,
  publishStoreOfferBriefing,
} from "./store-offer-briefing.server";

const actor = {
  familyId: "family-1",
  userId: "user-1",
};

describe("store-offer-briefing.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue({
      familyId: "family-1",
      role: "MEMBER",
      userId: "user-1",
    });
  });

  it("upserts one briefing per family week and replaces it on republish", async () => {
    const nextWeek = getNextCalendarWeekBounds();
    dbMock.storeOfferBriefing.upsert
      .mockResolvedValueOnce({ id: "briefing-1" })
      .mockResolvedValueOnce({ id: "briefing-1" });

    const created = await publishStoreOfferBriefing({
      ...actor,
      content: "Rema 1000\nLaks, 79,20",
      subtitle: "Handle i helgen.",
      title: "Rema 1000 er beste hovedbutikk",
    });
    const replaced = await publishStoreOfferBriefing({
      ...actor,
      content: "Kiwi\nPesto, 22,40",
      subtitle: "Tilbudene går ut søndag.",
      title: "Kiwi er beste hovedbutikk",
    });

    expect(created).toEqual({
      briefingId: "briefing-1",
      status: "PUBLISHED",
      weekEnd: nextWeek.weekEnd,
      weekStart: nextWeek.weekStart,
    });
    expect(replaced.status).toBe("PUBLISHED");
    expect(dbMock.storeOfferBriefing.upsert).toHaveBeenCalledTimes(2);
    expect(dbMock.storeOfferBriefing.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          content: "Kiwi\nPesto, 22,40",
          title: "Kiwi er beste hovedbutikk",
        }),
        where: {
          familyId_weekStart: {
            familyId: "family-1",
            weekStart: new Date(`${nextWeek.weekStart}T00:00:00.000Z`),
          },
        },
      }),
    );
  });

  it("does not write when the text or week is invalid", async () => {
    const empty = await publishStoreOfferBriefing({
      ...actor,
      content: "Funnene",
      subtitle: " ",
      title: "Rema 1000",
    });
    const badWeek = await publishStoreOfferBriefing({
      ...actor,
      content: "Funnene",
      subtitle: "Handle i helgen.",
      title: "Rema 1000",
      weekEnd: "2026-10-19",
      weekStart: "2026-10-13",
    });

    expect(empty.status).toBe("VALIDATION_ERROR");
    expect(badWeek.status).toBe("VALIDATION_ERROR");
    expect(dbMock.storeOfferBriefing.upsert).not.toHaveBeenCalled();
  });

  it("returns the stored texts or an empty result", async () => {
    const nextWeek = getNextCalendarWeekBounds();
    dbMock.storeOfferBriefing.findUnique
      .mockResolvedValueOnce({
        content: "Rema 1000\nLaks, 79,20",
        id: "briefing-1",
        subtitle: "Handle i helgen.",
        title: "Rema 1000 er beste hovedbutikk",
        updatedAt: new Date("2026-10-15T10:00:00.000Z"),
        weekEnd: new Date(`${nextWeek.weekEnd}T00:00:00.000Z`),
        weekStart: new Date(`${nextWeek.weekStart}T00:00:00.000Z`),
      })
      .mockResolvedValueOnce(null);

    await expect(getStoreOfferBriefing(actor)).resolves.toEqual({
      briefing: {
        content: "Rema 1000\nLaks, 79,20",
        id: "briefing-1",
        subtitle: "Handle i helgen.",
        title: "Rema 1000 er beste hovedbutikk",
        updatedAt: "2026-10-15T10:00:00.000Z",
        weekEnd: nextWeek.weekEnd,
        weekStart: nextWeek.weekStart,
      },
      status: "FOUND",
      weekEnd: nextWeek.weekEnd,
      weekStart: nextWeek.weekStart,
    });
    await expect(getStoreOfferBriefing(actor)).resolves.toEqual({
      briefing: null,
      status: "EMPTY",
      weekEnd: nextWeek.weekEnd,
      weekStart: nextWeek.weekStart,
    });
  });
});
