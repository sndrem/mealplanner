// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StoreModeShoppingItemCard } from "./store-mode-shopping-item-card";
import { renderWithRouter } from "../test/render-with-router";

const familyItem = {
  category: { id: "cat-dairy", name: "Meieri" },
  checked: false,
  collaborationVersion: "2026-05-01T12:00:00.000Z",
  name: "Melk",
  note: "Tine lettmelk",
  preferredStore: null,
  quantity: "1 l",
  quantityLabel: "1 l",
  sourceKey: "family-milk",
  sourceType: "FAMILY" as const,
};

describe("StoreModeShoppingItemCard", () => {
  it("hides edit and quick-add controls in read-only mode but still toggles", () => {
    const onToggle = vi.fn();

    renderWithRouter(
      <StoreModeShoppingItemCard
        item={familyItem}
        layout="grid"
        onToggle={onToggle}
        readOnly
        selectedStoreId="store-1"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Hurtiglegg til" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Sett mengde")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Endre seksjon")).not.toBeInTheDocument();
    expect(screen.getByText("1 l")).toBeInTheDocument();
    expect(screen.getByText("Tine lettmelk")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Marker Melk som handlet" }),
    );
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows quick-add when not read-only", () => {
    renderWithRouter(
      <StoreModeShoppingItemCard
        categories={[{ displayName: "Meieri", familyId: null, id: "cat-dairy", key: "dairy" }]}
        item={familyItem}
        layout="grid"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Hurtiglegg til" }),
    ).toBeInTheDocument();
  });
});
