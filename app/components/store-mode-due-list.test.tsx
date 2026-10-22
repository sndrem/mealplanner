// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StoreModeDueList } from "./store-mode-due-list";
import { renderWithRouter } from "../test/render-with-router";

const milk = {
  category: { id: "dairy", name: "Meieri" },
  checked: false,
  collaborationVersion: "v1",
  name: "Melk",
  note: null,
  preferredStore: null,
  quantity: "2 l",
  quantityLabel: "2 l",
  sourceKey: "family-milk",
  sourceType: "FAMILY" as const,
};

const stockIngredients = [
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
];

function renderDueList({
  layout = "grid" as "grid" | "list",
  simpleView = false,
} = {}) {
  return renderWithRouter(
    <StoreModeDueList
      activeSections={[
        {
          boughtItems: [],
          category: { id: "dairy" },
          displayName: "Meieri",
          items: [milk],
        },
      ]}
      canMarkAsStock={false}
      categories={[]}
      categoryFetcherError={null}
      categoryInteractionSourceKey=""
      deprioritizeBought={false}
      displaySectionCount={1}
      hasUncheckedDueItems
      hasUnusedStockIngredients
      hiddenHeadingLists={null}
      isCelebrating={false}
      isOptingInAllStockItems={false}
      isSavingCategorySourceKey={null}
      layout={layout}
      onDismissStockReminder={vi.fn()}
      onQuickAddFromCard={vi.fn()}
      onRestoreStockReminder={vi.fn()}
      onToggleItem={vi.fn()}
      onUpdateCategory={vi.fn()}
      onUpdateQuantity={vi.fn()}
      optingInStockSourceKey={null}
      pendingMarkAsStockSourceKey=""
      recentlyAddedSourceKey={null}
      showCategoryHeadings
      showRecipeUrgency={false}
      simpleView={simpleView}
      stockIngredients={stockIngredients}
      stockReminderDismissed={false}
    />,
  );
}

describe("StoreModeDueList", () => {
  it("shows the basisvarer reminder and a section card by default", () => {
    renderDueList();

    expect(screen.getByText("Basisvarer")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Meieri" })).not.toBeInTheDocument();
  });

  it("uses a heading and two columns in enkel visning and hides basisvarer", () => {
    const { container } = renderDueList({ simpleView: true });

    expect(screen.queryByText("Basisvarer")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meieri" })).toBeInTheDocument();
    expect(screen.queryByText("1 varer")).not.toBeInTheDocument();
    expect(container.querySelector(".grid-cols-2")).not.toBeNull();
  });

  it("keeps enkel visning to one column in liste", () => {
    const { container } = renderDueList({ layout: "list", simpleView: true });

    expect(container.querySelector(".grid-cols-2")).toBeNull();
    expect(container.querySelector(".flex-col")).not.toBeNull();
  });
});
