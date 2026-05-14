import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => {
  return {
    dbMock: {
      mealPlan: {
        findFirst: vi.fn(),
      },
    },
    requireFamilyMembershipMock: vi.fn(),
  };
});

vi.mock("./db.server", () => {
  return {
    db: dbMock,
  };
});

vi.mock("./family.server", () => {
  return {
    requireFamilyMembership: requireFamilyMembershipMock,
  };
});

import {
  createCalendarFile,
  getMealPlanCalendarExport,
  getMealPlanDayCalendarExport,
} from "./calendar.server";

const mockMembership = {
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

describe("calendar.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-14T09:30:45.000Z"));
    requireFamilyMembershipMock.mockResolvedValue(mockMembership);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates timed ICS content with CRLF line endings and escaped values", () => {
    const content = createCalendarFile("Mealplanner - Langhelg", [
      {
        date: "2026-05-15",
        description: "Linje 1,\nLinje 2; med \\ tegn",
        title: "Middag, pesto; pasta",
        uid: "meal-plan-1\\2026-05-15",
      },
    ]);

    expect(content).toContain("\r\nBEGIN:VEVENT\r\n");
    expect(content).toContain("DTSTAMP:20260514T093045Z");
    expect(content).toContain("X-WR-TIMEZONE:Europe/Oslo");
    expect(content).toContain("SUMMARY:Middag\\, pesto\\; pasta");
    expect(content).toContain("DESCRIPTION:Linje 1\\,\\nLinje 2\\; med \\\\ tegn");
    expect(content).toContain("UID:meal-plan-1\\\\2026-05-15");
    expect(content).toContain("DTSTART;TZID=Europe/Oslo:20260515T160000");
    expect(content).toContain("DTEND;TZID=Europe/Oslo:20260515T170000");
  });

  it("exports only recipe-backed meal-plan dinners", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [
        {
          date: new Date("2026-05-15T00:00:00.000Z"),
          recipe: {
            description: null,
            title: "Taco fredag",
          },
          recipeId: "recipe-1",
        },
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          recipe: null,
          recipeId: "",
        },
      ],
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      title: "Langhelg",
    });

    const result = await getMealPlanCalendarExport({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(requireFamilyMembershipMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result.fileName).toBe("langhelg-ukeplan.ics");
    expect(result.content.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(result.content).toContain("SUMMARY:Middag: Taco fredag");
    expect(result.content).toContain("DESCRIPTION:Planlagt for");
    expect(result.content).toContain("i Langhelg. Ingen beskrivelse.");
  });

  it("exports a single day as a timed dinner calendar file", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          recipe: {
            description: "Rask middagsfavoritt.",
            title: "Kyllingtaco",
          },
          recipeId: "recipe-1",
        },
      ],
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      title: "Langhelg",
    });

    const result = await getMealPlanDayCalendarExport({
      date: "2026-05-16",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.fileName).toBe("langhelg-2026-05-16.ics");
    expect(result.content.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(result.content).toContain("SUMMARY:Middag: Kyllingtaco");
    expect(result.content).toContain("DTSTART;TZID=Europe/Oslo:20260516T160000");
    expect(result.content).toContain("DTEND;TZID=Europe/Oslo:20260516T170000");
    expect(result.content).toContain("Rask middagsfavoritt.");
  });

  it("rejects invalid day exports before creating a file", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [],
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      title: "Langhelg",
    });

    await expect(
      getMealPlanDayCalendarExport({
        date: "2026-05-32",
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
  });
});
