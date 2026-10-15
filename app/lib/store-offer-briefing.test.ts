import { describe, expect, it } from "vitest";

import { getNextCalendarWeekBounds } from "./meal-plan-week";
import {
  PUBLISH_STORE_OFFER_BRIEFING_DESCRIPTION,
  parseStoreOfferBriefingText,
  resolveStoreOfferBriefingWeek,
  selectStoreOfferBriefing,
  STORE_OFFER_BRIEFING_CONTENT_MAX_LENGTH,
  STORE_OFFER_BRIEFING_EXPIRED_MESSAGE,
  STORE_OFFER_BRIEFING_TITLE_MAX_LENGTH,
  type StoreOfferBriefingRecord,
} from "./store-offer-briefing";

const referenceDate = new Date("2026-10-15T12:00:00.000Z");
const today = "2026-10-15";
const currentWeek = {
  weekEnd: "2026-10-18",
  weekStart: "2026-10-12",
};
const nextWeek = getNextCalendarWeekBounds(referenceDate);

function briefing(
  overrides: Partial<StoreOfferBriefingRecord> &
    Pick<StoreOfferBriefingRecord, "id" | "weekEnd" | "weekStart">,
): StoreOfferBriefingRecord {
  return {
    content: "Rema 1000\nLaks, 79,20",
    subtitle: "Handle i helgen.",
    title: "Rema 1000 er beste hovedbutikk",
    updatedAt: "2026-10-14T08:00:00.000Z",
    ...overrides,
  };
}

describe("store-offer-briefing", () => {
  it("trims text and rejects empty or oversized fields", () => {
    expect(
      parseStoreOfferBriefingText({
        content: "  Funnene  ",
        subtitle: "  Handle i helgen.  ",
        title: "  Rema 1000  ",
      }),
    ).toEqual({
      content: "Funnene",
      ok: true,
      subtitle: "Handle i helgen.",
      title: "Rema 1000",
    });

    expect(
      parseStoreOfferBriefingText({
        content: "Funnene",
        subtitle: "   ",
        title: "Rema 1000",
      }).ok,
    ).toBe(false);
    expect(
      parseStoreOfferBriefingText({
        content: "x".repeat(STORE_OFFER_BRIEFING_CONTENT_MAX_LENGTH + 1),
        subtitle: "Handle i helgen.",
        title: "Rema 1000",
      }).ok,
    ).toBe(false);
    expect(
      parseStoreOfferBriefingText({
        content: "Funnene",
        subtitle: "Handle i helgen.",
        title: "x".repeat(STORE_OFFER_BRIEFING_TITLE_MAX_LENGTH + 1),
      }).ok,
    ).toBe(false);
  });

  it("defaults a missing week to next Monday–Sunday and rejects a partial week", () => {
    expect(
      resolveStoreOfferBriefingWeek({
        referenceDate,
      }),
    ).toEqual({
      ok: true,
      weekEnd: nextWeek.weekEnd,
      weekStart: nextWeek.weekStart,
    });
    expect(nextWeek).toEqual({
      weekEnd: "2026-10-25",
      weekStart: "2026-10-19",
    });

    expect(
      resolveStoreOfferBriefingWeek({
        weekStart: "2026-10-12",
      }).ok,
    ).toBe(false);
    expect(
      resolveStoreOfferBriefingWeek({
        weekEnd: "2026-10-19",
        weekStart: "2026-10-13",
      }).ok,
    ).toBe(false);
    expect(
      resolveStoreOfferBriefingWeek({
        weekEnd: currentWeek.weekEnd,
        weekStart: currentWeek.weekStart,
      }),
    ).toEqual({
      ok: true,
      ...currentWeek,
    });
  });

  it("shows a next-week briefing on the current focus until the week ends", () => {
    const selection = selectStoreOfferBriefing({
      briefings: [
        briefing({
          id: "next",
          weekEnd: nextWeek.weekEnd,
          weekStart: nextWeek.weekStart,
        }),
      ],
      focusedDates: ["2026-10-12", "2026-10-15", "2026-10-18"],
      nextWeek,
      today,
    });

    expect(selection.kind).toBe("loud");
    if (selection.kind === "loud") {
      expect(selection.briefing.id).toBe("next");
    }
  });

  it("prefers the briefing that contains the focused span", () => {
    const selection = selectStoreOfferBriefing({
      briefings: [
        briefing({
          id: "current",
          weekEnd: currentWeek.weekEnd,
          weekStart: currentWeek.weekStart,
        }),
        briefing({
          id: "next",
          weekEnd: nextWeek.weekEnd,
          weekStart: nextWeek.weekStart,
        }),
      ],
      focusedDates: ["2026-10-12", "2026-10-15", "2026-10-18"],
      nextWeek,
      today,
    });

    expect(selection).toEqual(
      expect.objectContaining({
        kind: "loud",
      }),
    );
    if (selection.kind === "loud") {
      expect(selection.briefing.id).toBe("current");
    }
  });

  it("picks the earliest ending loud briefing when none contains the whole focus", () => {
    const selection = selectStoreOfferBriefing({
      briefings: [
        briefing({
          id: "current",
          weekEnd: currentWeek.weekEnd,
          weekStart: currentWeek.weekStart,
        }),
        briefing({
          id: "next",
          weekEnd: nextWeek.weekEnd,
          weekStart: nextWeek.weekStart,
        }),
      ],
      focusedDates: ["2026-10-12", "2026-10-25"],
      nextWeek,
      today,
    });

    if (selection.kind === "loud") {
      expect(selection.briefing.id).toBe("current");
    } else {
      expect(selection.kind).toBe("loud");
    }
  });

  it("quiets an expired briefing that still overlaps the focused week", () => {
    const selection = selectStoreOfferBriefing({
      briefings: [
        briefing({
          id: "past",
          weekEnd: "2026-10-11",
          weekStart: "2026-10-05",
        }),
      ],
      focusedDates: ["2026-10-05", "2026-10-11"],
      nextWeek,
      today,
    });

    expect(selection).toEqual({
      kind: "quiet",
      message: STORE_OFFER_BRIEFING_EXPIRED_MESSAGE,
    });
  });

  it("hides a briefing that is neither current nor next", () => {
    expect(
      selectStoreOfferBriefing({
        briefings: [
          briefing({
            id: "later",
            weekEnd: "2026-11-08",
            weekStart: "2026-11-02",
          }),
        ],
        focusedDates: ["2026-10-12", "2026-10-18"],
        nextWeek,
        today,
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("describes the three-text format for the agent", () => {
    expect(PUBLISH_STORE_OFFER_BRIEFING_DESCRIPTION).toContain("title");
    expect(PUBLISH_STORE_OFFER_BRIEFING_DESCRIPTION).toContain("subtitle");
    expect(PUBLISH_STORE_OFFER_BRIEFING_DESCRIPTION).toContain("content");
    expect(PUBLISH_STORE_OFFER_BRIEFING_DESCRIPTION).toContain("plain text");
    expect(PUBLISH_STORE_OFFER_BRIEFING_DESCRIPTION).toContain("Markdown");
  });
});
