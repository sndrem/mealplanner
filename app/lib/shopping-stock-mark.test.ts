import { describe, expect, it } from "vitest";

import {
  getGeneratedStockMarkTargets,
  parseGeneratedStockMarkTargets,
} from "./shopping-stock-mark";

describe("shopping stock mark targets", () => {
  it("uses the card source key for a single generated line", () => {
    expect(
      getGeneratedStockMarkTargets({
        mealPlanId: "meal-plan-1",
        sourceKey: "entry-1:line-1",
      }),
    ).toEqual([
      {
        mealPlanId: "meal-plan-1",
        sourceKey: "entry-1:line-1",
      },
    ]);
  });

  it("uses member source keys for a grouped card", () => {
    expect(
      getGeneratedStockMarkTargets({
        groupingMembers: [
          {
            mealPlanId: "meal-plan-1",
            sourceKey: "entry-1:line-1|entry-2:line-2",
          },
          {
            mealPlanId: "meal-plan-2",
            sourceKey: "entry-3:line-3",
          },
        ],
        mealPlanId: "meal-plan-1",
        sourceKey: "entry-1:line-1|entry-2:line-2|entry-3:line-3",
      }),
    ).toEqual([
      {
        mealPlanId: "meal-plan-1",
        sourceKey: "entry-1:line-1|entry-2:line-2",
      },
      {
        mealPlanId: "meal-plan-2",
        sourceKey: "entry-3:line-3",
      },
    ]);
  });

  it("parses paired member fields and rejects a mismatched pair", () => {
    const formData = new FormData();
    formData.append("memberMealPlanId", "meal-plan-1");
    formData.append("memberSourceKey", "entry-1:line-1");
    formData.append("memberMealPlanId", "meal-plan-2");
    formData.append("memberSourceKey", "entry-2:line-2");

    expect(parseGeneratedStockMarkTargets(formData)).toEqual([
      {
        mealPlanId: "meal-plan-1",
        sourceKey: "entry-1:line-1",
      },
      {
        mealPlanId: "meal-plan-2",
        sourceKey: "entry-2:line-2",
      },
    ]);

    const mismatched = new FormData();
    mismatched.append("memberMealPlanId", "meal-plan-1");

    expect(parseGeneratedStockMarkTargets(mismatched)).toEqual([]);
  });
});
