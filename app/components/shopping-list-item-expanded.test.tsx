// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShoppingListItemExpanded } from "./shopping-list-item-expanded";
import { renderWithRouter } from "../test/render-with-router";

const familyItem = {
  checked: false,
  collaborationVersion: "2026-05-15T00:00:00.000Z",
  name: "Tørkerull",
  note: null,
  sourceKey: "family-item-1",
  sourceType: "FAMILY" as const,
};

describe("ShoppingListItemExpanded", () => {
  it("keeps family check, edit, and delete actions", () => {
    renderWithRouter(
      <ShoppingListItemExpanded
        categories={[{ displayName: "Husholdning", id: "category-household" }]}
        displayChecked={false}
        familyValues={{
          categoryId: "category-household",
          name: "Tørkerull",
          note: "",
          preferredStoreId: "",
          quantity: "1 pk",
        }}
        isPendingCheckToggle={false}
        item={familyItem}
        stores={[]}
        toggleExpectedVersion="2026-05-15T00:00:00.000Z"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Marker som kjøpt" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Varenavn")).toHaveValue("Tørkerull");
    expect(
      screen.getByRole("button", { name: "Lagre varelinje" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Slett varelinje" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Fjern fra handlelisten" }),
    ).not.toBeInTheDocument();
  });
});
