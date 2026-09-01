import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/calendar-subscription.server", () => ({
  getFamilyCalendarFeedByToken: vi.fn(),
}));

import { getFamilyCalendarFeedByToken } from "../lib/calendar-subscription.server";
import { loader } from "./calendar-subscription";

describe("calendar subscription route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns an inline calendar without requiring a session", async () => {
    vi.mocked(getFamilyCalendarFeedByToken).mockResolvedValue({
      content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
    });

    const result = await loader({
      params: {
        token: "feed-token",
      },
    });

    expect(getFamilyCalendarFeedByToken).toHaveBeenCalledWith("feed-token");
    expect(result.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(result.headers.get("Content-Disposition")).toBe(
      'inline; filename="mealplanner.ics"',
    );
    expect(result.headers.get("Cache-Control")).toBe("private, max-age=3600");
    await expect(result.text()).resolves.toBe("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
  });

  it("returns 404 for an unknown token", async () => {
    vi.mocked(getFamilyCalendarFeedByToken).mockResolvedValue(null);

    await expect(
      loader({
        params: {
          token: "missing",
        },
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
  });

  it("returns 404 when the token param is missing", async () => {
    await expect(
      loader({
        params: {},
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
    expect(getFamilyCalendarFeedByToken).not.toHaveBeenCalled();
  });
});
