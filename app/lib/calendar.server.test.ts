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
    expect(content).toContain("BEGIN:VTIMEZONE");
    expect(content).toContain("TZID:Europe/Oslo");
    expect(content).not.toContain("REFRESH-INTERVAL");
    expectIcsLinesHaveNoBareCarriageReturns(content);
  });

  it("omits a blank event block for an empty calendar and can emit feed headers", () => {
    const content = createCalendarFile("Mealplanner - Solberg", [], new Date(), {
      includeRefreshInterval: true,
    });

    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain("END:VCALENDAR");
    expect(content).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(content).toContain("X-PUBLISHED-TTL:PT1H");
    expect(content).not.toContain("BEGIN:VEVENT");
    expect(content).not.toMatch(/\r\n\r\nEND:VCALENDAR/);
    expectIcsLinesHaveNoBareCarriageReturns(content);
  });

  it("uses event timestamps for feed DTSTAMP and LAST-MODIFIED", () => {
    const content = createCalendarFile(
      "Mealplanner - Solberg",
      [
        {
          date: "2026-05-15",
          description: "Taco",
          lastModified: new Date("2026-05-13T18:00:00.000Z"),
          title: "Middag: Taco",
          uid: "meal-plan-1-2026-05-15@mealplanner",
        },
      ],
      new Date(),
      {
        useEventTimestamps: true,
      },
    );

    expect(content).toContain("DTSTAMP:20260513T180000Z");
    expect(content).toContain("LAST-MODIFIED:20260513T180000Z");
    expect(content).not.toContain("DTSTAMP:20260514T093045Z");
    expectIcsLinesHaveNoBareCarriageReturns(content);
  });

  it("escapes CRLF and CR recipe descriptions without breaking ICS line endings", () => {
    const content = createCalendarFile("Mealplanner - Uke 35", [
      {
        date: "2026-08-25",
        description:
          "Planlagt for tirsdag 25. august 2026 i Uke 35. 1. Salt og pepre kyllingfilter av lårfilet\r\n2. Sleng i poteter, gulrøtter, champignon og løk\r\n3. Ha i kyllingkraft",
        title: "Middag: Kremet kyllinggryte med sopp i Crock pot",
        uid: "meal-plan-1-2026-08-25@mealplanner",
      },
      {
        date: "2026-08-26",
        description: "Planlagt for onsdag 26. august 2026 i Uke 35. Steg 1\rSteg 2",
        title: "Middag: Bakt laksepasta",
        uid: "meal-plan-1-2026-08-26@mealplanner",
      },
    ]);

    expect(content).toContain(
      "DESCRIPTION:Planlagt for tirsdag 25. august 2026 i Uke 35. 1. Salt og pepre kyllingfilter av lårfilet\\n2. Sleng i poteter\\, gulrøtter\\, champignon og løk\\n3. Ha i kyllingkraft",
    );
    expect(content).toContain(
      "DESCRIPTION:Planlagt for onsdag 26. august 2026 i Uke 35. Steg 1\\nSteg 2",
    );
    expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expectIcsLinesHaveNoBareCarriageReturns(content);
  });

  it("exports recipe-backed and freezer-backed meal-plan dinners", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [
        {
          date: new Date("2026-05-15T00:00:00.000Z"),
          freezerItem: null,
          freezerItemId: null,
          recipe: {
            description: "Steg 1\r\nSteg 2",
            title: "Taco fredag",
          },
          recipeId: "recipe-1",
          updatedAt: new Date("2026-05-14T08:00:00.000Z"),
        },
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          freezerItem: {
            label: "Chili fra fryseren",
            note: "Tina i micro",
          },
          freezerItemId: "freezer-1",
          recipe: null,
          recipeId: null,
          updatedAt: new Date("2026-05-14T08:00:00.000Z"),
        },
        {
          date: new Date("2026-05-17T00:00:00.000Z"),
          freezerItem: null,
          freezerItemId: null,
          recipe: null,
          recipeId: "",
          updatedAt: new Date("2026-05-14T08:00:00.000Z"),
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
    expect(result.content.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(result.content).toContain("SUMMARY:Middag: Taco fredag");
    expect(result.content).toContain("SUMMARY:Middag: Chili fra fryseren");
    expect(result.content).toContain("Tina i micro");
    expect(result.content).toContain("Steg 1\\nSteg 2");
    expectIcsLinesHaveNoBareCarriageReturns(result.content);
  });

  it("exports a single day as a timed dinner calendar file", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          freezerItem: null,
          freezerItemId: null,
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

  it("rejects an empty meal-plan export before creating a file", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [],
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      title: "Langhelg",
    });

    await expect(
      getMealPlanCalendarExport({
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
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

function expectIcsLinesHaveNoBareCarriageReturns(content: string) {
  for (const line of content.split("\r\n")) {
    expect(line).not.toMatch(/[\r\n]/);
  }
}
