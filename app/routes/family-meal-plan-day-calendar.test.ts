import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>(
    "../lib/auth.server",
  );

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/calendar.server", () => {
  return {
    getMealPlanDayCalendarExport: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getMealPlanDayCalendarExport } from "../lib/calendar.server";
import { loader } from "./family-meal-plan-day-calendar";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/meal-plans/meal-plan-1/days/2026-05-16/calendar.ics",
) {
  return new Request(url);
}

describe("family meal plan day calendar route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a single-day calendar attachment response", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanDayCalendarExport).mockResolvedValue({
      content: "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nEND:VEVENT\r\nEND:VCALENDAR",
      fileName: "langhelg-2026-05-16.ics",
    });

    const result = await loader({
      params: {
        date: "2026-05-16",
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(),
    });

    expect(getMealPlanDayCalendarExport).toHaveBeenCalledWith({
      date: "2026-05-16",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(result.headers.get("Content-Disposition")).toBe(
      'attachment; filename="langhelg-2026-05-16.ics"',
    );
    await expect(result.text()).resolves.toBe(
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nEND:VEVENT\r\nEND:VCALENDAR",
    );
  });

  it("propagates not-found responses from the export service", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanDayCalendarExport).mockRejectedValue(
      new Response("Fant ikke dagen i ukeplanen.", {
        status: 404,
        statusText: "Not Found",
      }),
    );

    await expect(
      loader({
        params: {
          date: "2026-05-30",
          familyId: "family-1",
          mealPlanId: "meal-plan-1",
        },
        request: buildRequest(
          "http://localhost/families/family-1/meal-plans/meal-plan-1/days/2026-05-30/calendar.ics",
        ),
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
  });
});
