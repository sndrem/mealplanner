// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useShoppingListCompletionCelebration } from "./use-shopping-list-completion-celebration";

describe("useShoppingListCompletionCelebration", () => {
  it("does not celebrate when the list starts complete", () => {
    const { result } = renderHook(() =>
      useShoppingListCompletionCelebration({
        checkedCount: 2,
        totalCount: 2,
      }),
    );

    expect(result.current.isCelebrating).toBe(false);
  });

  it("celebrates when the last item is checked off", () => {
    const { result, rerender } = renderHook(
      ({ progress }) => useShoppingListCompletionCelebration(progress),
      {
        initialProps: {
          progress: { checkedCount: 1, totalCount: 2 },
        },
      },
    );

    rerender({ progress: { checkedCount: 2, totalCount: 2 } });

    expect(result.current.isCelebrating).toBe(true);
  });

  it("dismisses celebration when an item is unchecked", () => {
    const { result, rerender } = renderHook(
      ({ progress }) => useShoppingListCompletionCelebration(progress),
      {
        initialProps: {
          progress: { checkedCount: 1, totalCount: 2 },
        },
      },
    );

    rerender({ progress: { checkedCount: 2, totalCount: 2 } });
    rerender({ progress: { checkedCount: 1, totalCount: 2 } });

    expect(result.current.isCelebrating).toBe(false);
  });

  it("can dismiss celebration manually", () => {
    const { result, rerender } = renderHook(
      ({ progress }) => useShoppingListCompletionCelebration(progress),
      {
        initialProps: {
          progress: { checkedCount: 0, totalCount: 1 },
        },
      },
    );

    rerender({ progress: { checkedCount: 1, totalCount: 1 } });

    act(() => {
      result.current.dismissCelebration();
    });

    expect(result.current.isCelebrating).toBe(false);
  });
});
