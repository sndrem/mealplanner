// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StoreModeStockIngredientsReminder } from "./store-mode-stock-ingredients-reminder";
import { renderWithRouter } from "../test/render-with-router";

const ingredients = [
  {
    name: "Salt",
    occurrenceCount: 1,
    occurrences: [
      {
        date: "2026-05-16",
        mealPlanEntryId: "entry-1",
        quantityLabel: "1 ts",
        recipeIngredientId: "ingredient-1",
        recipeTitle: "Pasta",
      },
    ],
    quantityLabel: "1 ts",
    sourceKey: "salt-1",
  },
  {
    name: "Olje",
    occurrenceCount: 1,
    occurrences: [
      {
        date: "2026-05-17",
        mealPlanEntryId: "entry-2",
        quantityLabel: "2 ss",
        recipeIngredientId: "ingredient-2",
        recipeTitle: "Salat",
      },
    ],
    quantityLabel: "2 ss",
    sourceKey: "oil-1",
  },
];

describe("StoreModeStockIngredientsReminder", () => {
  it("shows the staple count in the collapsed row", () => {
    renderWithRouter(
      <StoreModeStockIngredientsReminder
        ingredients={ingredients}
        onDismiss={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    expect(screen.getByText("Basisvarer")).toBeInTheDocument();
    expect(screen.getByText("2 varer")).toBeInTheDocument();
  });

  it("dismisses from the collapsed row without expanding", () => {
    const onDismiss = vi.fn();

    renderWithRouter(
      <StoreModeStockIngredientsReminder
        ingredients={ingredients}
        onDismiss={onDismiss}
        onRestore={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skjul" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Basisvarer").closest("details")).not.toHaveAttribute(
      "open",
    );
  });

  it("restores the reminder from the dismissed row", () => {
    const onRestore = vi.fn();

    renderWithRouter(
      <StoreModeStockIngredientsReminder
        dismissed
        ingredients={ingredients}
        onDismiss={vi.fn()}
        onRestore={onRestore}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Vis basisvarer/ }));

    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});
