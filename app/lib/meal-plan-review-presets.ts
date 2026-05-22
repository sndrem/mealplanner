export const MEAL_PLAN_REVIEW_QUICK_RESPONSE_RECENTLY_HAD = "RECENTLY_HAD";
export const MEAL_PLAN_REVIEW_QUICK_RESPONSE_FISH_AGAIN = "FISH_AGAIN";
export const MEAL_PLAN_REVIEW_QUICK_RESPONSE_YES = "YES";

export type MealPlanReviewQuickResponse =
  | typeof MEAL_PLAN_REVIEW_QUICK_RESPONSE_RECENTLY_HAD
  | typeof MEAL_PLAN_REVIEW_QUICK_RESPONSE_FISH_AGAIN
  | typeof MEAL_PLAN_REVIEW_QUICK_RESPONSE_YES;

export const MEAL_PLAN_REVIEW_QUICK_RESPONSES = [
  MEAL_PLAN_REVIEW_QUICK_RESPONSE_RECENTLY_HAD,
  MEAL_PLAN_REVIEW_QUICK_RESPONSE_FISH_AGAIN,
  MEAL_PLAN_REVIEW_QUICK_RESPONSE_YES,
] as const satisfies readonly MealPlanReviewQuickResponse[];

const QUICK_RESPONSE_LABELS: Record<MealPlanReviewQuickResponse, string> = {
  [MEAL_PLAN_REVIEW_QUICK_RESPONSE_RECENTLY_HAD]: "Dette hadde vi for litt siden",
  [MEAL_PLAN_REVIEW_QUICK_RESPONSE_FISH_AGAIN]: "Fisk igjen...?",
  [MEAL_PLAN_REVIEW_QUICK_RESPONSE_YES]: "Ja!",
};

export function isMealPlanReviewQuickResponse(
  value: string,
): value is MealPlanReviewQuickResponse {
  return (MEAL_PLAN_REVIEW_QUICK_RESPONSES as readonly string[]).includes(value);
}

export function getMealPlanReviewQuickResponseLabel(
  quickResponse: MealPlanReviewQuickResponse,
) {
  return QUICK_RESPONSE_LABELS[quickResponse];
}

export function formatMealPlanReviewFeedback(input: {
  body: string | null;
  quickResponse: MealPlanReviewQuickResponse | null;
}) {
  if (input.quickResponse) {
    return getMealPlanReviewQuickResponseLabel(input.quickResponse);
  }

  return input.body?.trim() ?? "";
}

export function getMealPlanReviewQuickResponseOptions() {
  return MEAL_PLAN_REVIEW_QUICK_RESPONSES.map((value) => ({
    label: getMealPlanReviewQuickResponseLabel(value),
    value,
  }));
}
