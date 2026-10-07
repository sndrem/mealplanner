// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetcherState, submitMock } = vi.hoisted(() => {
  return {
    fetcherState: {
      data: undefined as
        | {
            ingredientSearchResults: Array<{
              canonicalName: string;
              defaultCategoryId: string | null;
              defaultQuantity?: string | null;
              id: string;
              source?: "catalog" | "register";
            }>;
          }
        | undefined,
    },
    submitMock: vi.fn(),
  };
});

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();

  return {
    ...actual,
    useFetcher: () => ({
      data: fetcherState.data,
      load: vi.fn(),
      state: "idle" as const,
      submit: submitMock,
    }),
  };
});

import { SHOPPING_QUICK_ADD_ROOT_ATTRIBUTE } from "../lib/shopping-quick-add-feedback.client";
import { ManualShoppingQuickAdd } from "./manual-shopping-quick-add";

describe("ManualShoppingQuickAdd", () => {
  beforeEach(() => {
    fetcherState.data = undefined;
    submitMock.mockClear();
  });

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

  it("submits the matching register id when the typed name is exact", () => {
    const onQuickAddSubmit = vi.fn();

    const view = render(
      <ManualShoppingQuickAdd
        ingredientSearchPath="/search"
        onQuickAddSubmit={onQuickAddSubmit}
      />,
    );

    const input = screen.getByPlaceholderText("For eksempel melk");
    fireEvent.change(input, { target: { value: "melk" } });
    fetcherState.data = {
      ingredientSearchResults: [
        {
          canonicalName: "Melk",
          defaultCategoryId: "category-dairy",
          defaultQuantity: "1 l",
          id: "ingredient-milk",
          source: "register",
        },
      ],
    };
    view.rerender(
      <ManualShoppingQuickAdd
        ingredientSearchPath="/search"
        onQuickAddSubmit={onQuickAddSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Legg til" }));

    const formData = submitMock.mock.calls[0]?.[0] as FormData;
    expect(formData.get("ingredientId")).toBe("ingredient-milk");
    expect(formData.get("name")).toBeNull();
    expect(formData.get("quantity")).toBe("1 l");
    expect(onQuickAddSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "category-dairy",
        name: "Melk",
      }),
    );
  });

  it("submits a bare name when the typed text is only a partial match", () => {
    const view = render(<ManualShoppingQuickAdd ingredientSearchPath="/search" />);

    const input = screen.getByPlaceholderText("For eksempel melk");
    fireEvent.change(input, { target: { value: "mel" } });
    fetcherState.data = {
      ingredientSearchResults: [
        {
          canonicalName: "Melk",
          defaultCategoryId: "category-dairy",
          id: "ingredient-milk",
          source: "register",
        },
      ],
    };
    view.rerender(<ManualShoppingQuickAdd ingredientSearchPath="/search" />);
    fireEvent.keyDown(input, { key: "Enter" });

    const formData = submitMock.mock.calls[0]?.[0] as FormData;
    expect(formData.get("name")).toBe("mel");
    expect(formData.get("ingredientId")).toBeNull();
  });
});
