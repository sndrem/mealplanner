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
    getMealPlanCalendarExport: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getMealPlanCalendarExport } from "../lib/calendar.server";
import { loader } from "./family-meal-plan-calendar";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/meal-plans/meal-plan-1/calendar.ics",
) {
  return new Request(url);
}

describe("family meal plan calendar route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a calendar attachment response", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanCalendarExport).mockResolvedValue({
      content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
      fileName: "langhelg-ukeplan.ics",
    });

    const result = await loader({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(),
    });

    expect(getMealPlanCalendarExport).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(result.headers.get("Content-Disposition")).toBe(
      'attachment; filename="langhelg-ukeplan.ics"',
    );
    await expect(result.text()).resolves.toBe("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
  });

  it("throws a not-found response when the meal plan id route param is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);

    await expect(
      loader({
        params: {
          familyId: "family-1",
        },
        request: buildRequest("http://localhost/families/family-1/meal-plans/calendar.ics"),
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
  });
});
