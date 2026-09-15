// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();

  return {
    ...actual,
    useFetcher: () => ({
      data: undefined,
      load: vi.fn(),
      state: "idle" as const,
      submit: vi.fn(),
    }),
  };
});

import { SHOPPING_QUICK_ADD_ROOT_ATTRIBUTE } from "../lib/shopping-quick-add-feedback.client";
import { ManualShoppingQuickAdd } from "./manual-shopping-quick-add";

const recentManualItems = [
  {
    categoryId: "cat-dairy",
    displayName: "Melk",
    nameNormalized: "melk",
    quantity: "1 l",
  },
];

describe("ManualShoppingQuickAdd", () => {
  it("clears the name field and keeps it focused after add", () => {
    render(
      <ManualShoppingQuickAdd
        ingredientSearchPath="/search"
        recentManualItems={[]}
      />,
    );

    const input = screen.getByPlaceholderText("For eksempel melk");
    fireEvent.change(input, { target: { value: "Melk" } });
    fireEvent.click(screen.getByRole("button", { name: "Legg til" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(
      input.closest(`[${SHOPPING_QUICK_ADD_ROOT_ATTRIBUTE}]`),
    ).not.toBeNull();
  });

  it("keeps the name field focused after submitting with Enter", () => {
    render(
      <ManualShoppingQuickAdd
        ingredientSearchPath="/search"
        recentManualItems={[]}
      />,
    );

    const input = screen.getByPlaceholderText("For eksempel melk");
    fireEvent.change(input, { target: { value: "Brød" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("keeps the dock expanded after adding from a recent chip", () => {
    render(
      <ManualShoppingQuickAdd
        ingredientSearchPath="/search"
        recentManualItems={recentManualItems}
        revealOnFocus
      />,
    );

    const input = screen.getByPlaceholderText("For eksempel melk");
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("button", { name: "Melk" }));

    expect(input).toHaveFocus();
    expect(screen.getByRole("button", { name: "Melk" })).toBeVisible();
  });
});
