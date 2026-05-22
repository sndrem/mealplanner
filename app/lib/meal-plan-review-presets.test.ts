import { describe, expect, it } from "vitest";

import {
  MEAL_PLAN_REVIEW_QUICK_RESPONSE_FISH_AGAIN,
  MEAL_PLAN_REVIEW_QUICK_RESPONSE_RECENTLY_HAD,
  MEAL_PLAN_REVIEW_QUICK_RESPONSE_YES,
  formatMealPlanReviewFeedback,
  getMealPlanReviewQuickResponseLabel,
  getMealPlanReviewQuickResponseOptions,
  isMealPlanReviewQuickResponse,
} from "./meal-plan-review-presets";

describe("meal-plan-review-presets", () => {
  it("maps quick response enums to Norwegian labels", () => {
    expect(
      getMealPlanReviewQuickResponseLabel(MEAL_PLAN_REVIEW_QUICK_RESPONSE_RECENTLY_HAD),
    ).toBe("Dette hadde vi for litt siden");
    expect(
      getMealPlanReviewQuickResponseLabel(MEAL_PLAN_REVIEW_QUICK_RESPONSE_FISH_AGAIN),
    ).toBe("Fisk igjen...?");
    expect(getMealPlanReviewQuickResponseLabel(MEAL_PLAN_REVIEW_QUICK_RESPONSE_YES)).toBe(
      "Ja!",
    );
  });

  it("exposes all preset options for the review UI", () => {
    expect(getMealPlanReviewQuickResponseOptions()).toEqual([
      {
        label: "Dette hadde vi for litt siden",
        value: MEAL_PLAN_REVIEW_QUICK_RESPONSE_RECENTLY_HAD,
      },
      {
        label: "Fisk igjen...?",
        value: MEAL_PLAN_REVIEW_QUICK_RESPONSE_FISH_AGAIN,
      },
      {
        label: "Ja!",
        value: MEAL_PLAN_REVIEW_QUICK_RESPONSE_YES,
      },
    ]);
  });

  it("validates quick response values", () => {
    expect(isMealPlanReviewQuickResponse("YES")).toBe(true);
    expect(isMealPlanReviewQuickResponse("NOPE")).toBe(false);
  });

  it("formats feedback from preset or body", () => {
    expect(
      formatMealPlanReviewFeedback({
        body: null,
        quickResponse: MEAL_PLAN_REVIEW_QUICK_RESPONSE_FISH_AGAIN,
      }),
    ).toBe("Fisk igjen...?");
    expect(
      formatMealPlanReviewFeedback({
        body: "For mye pasta",
        quickResponse: null,
      }),
    ).toBe("For mye pasta");
  });
});
