// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShoppingListItemExpanded } from "./shopping-list-item-expanded";
import { renderWithRouter } from "../test/render-with-router";

const generatedItem = {
  checked: false,
  collaborationVersion: "2026-05-15T00:00:00.000Z",
  mealPlanId: "meal-plan-1",
  name: "Salt",
  note: null,
  occurrences: [],
  sourceKey: "entry-1:line-1",
  sourceType: "GENERATED" as const,
};

function renderExpanded({
  canMarkAsStock = false,
  item = generatedItem,
}: {
  canMarkAsStock?: boolean;
  item?: typeof generatedItem | {
    checked: boolean;
    collaborationVersion: string;
    name: string;
    note: null;
    sourceKey: string;
    sourceType: "MANUAL";
  };
} = {}) {
  return renderWithRouter(
    <ShoppingListItemExpanded
      canMarkAsStock={canMarkAsStock}
      categories={[]}
      displayChecked={false}
      isPendingCheckToggle={false}
      isPendingGeneratedExclude={false}
      isPendingGeneratedSave={false}
      isPendingManualDelete={false}
      isPendingManualSave={false}
      item={item}
      manualValues={null}
      overrideValues={null}
      stores={[]}
      toggleExpectedVersion="2026-05-15T00:00:00.000Z"
    />,
  );
}

describe("ShoppingListItemExpanded stock mark", () => {
  it("shows mark-as-stock for an admin on a generated item", () => {
    renderExpanded({ canMarkAsStock: true });

    fireEvent.click(screen.getByRole("button", { name: "Merk som basisvare" }));

    expect(
      screen.getByText(/Salt blir en basisvare og holdes utenfor handlelisten/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fjern fra handlelisten" }),
    ).toBeInTheDocument();
  });

  it("hides mark-as-stock for non-admins and manual items", () => {
    const { unmount } = renderExpanded();

    expect(
      screen.queryByRole("button", { name: "Merk som basisvare" }),
    ).not.toBeInTheDocument();
    unmount();

    renderExpanded({
      canMarkAsStock: true,
      item: {
        checked: false,
        collaborationVersion: "2026-05-15T00:00:00.000Z",
        name: "Tannkrem",
        note: null,
        sourceKey: "manual-1",
        sourceType: "MANUAL",
      },
    });

    expect(
      screen.queryByRole("button", { name: "Merk som basisvare" }),
    ).not.toBeInTheDocument();
  });
});
