import { afterEach, describe, expect, it, vi } from "vitest";

import { logCollaborationFailure, logCollaborationWrite } from "./write-observability.server";

describe("write-observability.server", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs structured collaboration writes", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logCollaborationWrite({
      action: "save-meal-plan-entries",
      domain: "meal-plan",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      outcome: "UPDATED",
      userId: "user-1",
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(infoSpy.mock.calls[0]?.[0]))).toMatchObject({
      action: "save-meal-plan-entries",
      domain: "meal-plan",
      event: "collaboration.write",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      outcome: "UPDATED",
      userId: "user-1",
    });
  });

  it("logs structured collaboration failures", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logCollaborationFailure({
      action: "toggle-shopping-item-checked",
      domain: "shopping",
      error: new Error("database unavailable"),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      outcome: "VALIDATION_ERROR",
      userId: "user-1",
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0]))).toMatchObject({
      action: "toggle-shopping-item-checked",
      domain: "shopping",
      error: {
        message: "database unavailable",
        name: "Error",
      },
      event: "collaboration.write_failed",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      outcome: "VALIDATION_ERROR",
      userId: "user-1",
    });
  });
});
