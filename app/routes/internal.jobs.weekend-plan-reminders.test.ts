import { beforeEach, describe, expect, it, vi } from "vitest";

const { envMock, isCronAuthorizationValidMock, runWeekendPlanRemindersMock } =
  vi.hoisted(() => {
    return {
      envMock: {
        CRON_SECRET: undefined as string | undefined,
      },
      isCronAuthorizationValidMock: vi.fn(),
      runWeekendPlanRemindersMock: vi.fn(),
    };
  });

vi.mock("../lib/env.server", () => {
  return {
    env: envMock,
  };
});

vi.mock("../lib/weekend-plan-reminder.server", () => {
  return {
    isCronAuthorizationValid: isCronAuthorizationValidMock,
    runWeekendPlanReminders: runWeekendPlanRemindersMock,
  };
});

import { action, loader } from "./internal.jobs.weekend-plan-reminders";

describe("internal weekend plan reminder job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.CRON_SECRET = "cron-secret";
    isCronAuthorizationValidMock.mockReturnValue(true);
    runWeekendPlanRemindersMock.mockResolvedValue({
      emailsFailed: 0,
      emailsSent: 1,
      skippedClaimed: 0,
      skippedOutsideWindow: false,
      skippedPlanned: 0,
      weekStart: "2026-08-24",
    });
  });

  it("rejects GET requests", async () => {
    await expect(loader()).rejects.toMatchObject({
      status: 405,
    });
  });

  it("returns 503 when CRON_SECRET is unset", async () => {
    envMock.CRON_SECRET = undefined;

    const response = await action({
      request: new Request(
        "https://example.com/internal/jobs/weekend-plan-reminders",
        { method: "POST" },
      ),
    });

    expect(response.status).toBe(503);
    expect(runWeekendPlanRemindersMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token is invalid", async () => {
    isCronAuthorizationValidMock.mockReturnValue(false);

    const response = await action({
      request: new Request(
        "https://example.com/internal/jobs/weekend-plan-reminders",
        {
          headers: {
            Authorization: "Bearer wrong",
          },
          method: "POST",
        },
      ),
    });

    expect(response.status).toBe(401);
    expect(runWeekendPlanRemindersMock).not.toHaveBeenCalled();
  });

  it("runs the job with the request origin", async () => {
    const response = await action({
      request: new Request(
        "https://mealplanner.example/internal/jobs/weekend-plan-reminders",
        {
          headers: {
            Authorization: "Bearer cron-secret",
          },
          method: "POST",
        },
      ),
    });

    expect(isCronAuthorizationValidMock).toHaveBeenCalledWith({
      authorizationHeader: "Bearer cron-secret",
      cronSecret: "cron-secret",
    });
    expect(runWeekendPlanRemindersMock).toHaveBeenCalledWith({
      force: false,
      origin: "https://mealplanner.example",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      emailsSent: 1,
      weekStart: "2026-08-24",
    });
  });

  it("passes force when the query flag is set", async () => {
    await action({
      request: new Request(
        "https://example.com/internal/jobs/weekend-plan-reminders?force=true",
        {
          headers: {
            Authorization: "Bearer cron-secret",
          },
          method: "POST",
        },
      ),
    });

    expect(runWeekendPlanRemindersMock).toHaveBeenCalledWith({
      force: true,
      origin: "https://example.com",
    });
  });
});
