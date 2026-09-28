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

describe("ManualShoppingQuickAdd", () => {
  it("clears the name field and keeps it focused after add", () => {
    render(<ManualShoppingQuickAdd ingredientSearchPath="/search" />);

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
    render(<ManualShoppingQuickAdd ingredientSearchPath="/search" />);

    const input = screen.getByPlaceholderText("For eksempel melk");
    fireEvent.change(input, { target: { value: "Brød" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("keeps the name field focused after adding from the docked layout", () => {
    render(
      <ManualShoppingQuickAdd ingredientSearchPath="/search" revealOnFocus />,
    );

    const input = screen.getByPlaceholderText("For eksempel melk");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Melk" } });
    fireEvent.click(screen.getByRole("button", { name: "Legg til" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Lukk" })).toBeNull();
  });
});
