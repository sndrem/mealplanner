// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SHOPPING_QUICK_ADD_ROOT_ATTRIBUTE,
  isShoppingQuickAddFocused,
  scrollToShoppingItem,
  shouldScrollItemIntoView,
} from "./shopping-quick-add-feedback.client";

function mockRect(element: HTMLElement, rect: Partial<DOMRect>) {
  element.getBoundingClientRect = () =>
    ({
      bottom: 40,
      height: 40,
      left: 0,
      right: 100,
      toJSON() {
        return this;
      },
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      ...rect,
    }) as DOMRect;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("shouldScrollItemIntoView", () => {
  it("returns false when the item is fully in the viewport", () => {
    const item = document.createElement("div");
    mockRect(item, { bottom: 200, top: 80 });
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);

    expect(shouldScrollItemIntoView(item)).toBe(false);
  });

  it("returns true when the item is above the viewport", () => {
    const item = document.createElement("div");
    mockRect(item, { bottom: -20, top: -80 });
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);

    expect(shouldScrollItemIntoView(item)).toBe(true);
  });

  it("returns true when the item is below the viewport", () => {
    const item = document.createElement("div");
    mockRect(item, { bottom: 980, top: 860 });
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);

    expect(shouldScrollItemIntoView(item)).toBe(true);
  });
});

describe("isShoppingQuickAddFocused", () => {
  it("returns true when the active element is inside the quick-add root", () => {
    const root = document.createElement("div");
    root.setAttribute(SHOPPING_QUICK_ADD_ROOT_ATTRIBUTE, "");
    const input = document.createElement("input");
    root.append(input);

    expect(isShoppingQuickAddFocused(input)).toBe(true);
  });

  it("returns false when another control is focused", () => {
    const select = document.createElement("select");

    expect(isShoppingQuickAddFocused(select)).toBe(false);
  });
});

describe("scrollToShoppingItem", () => {
  it("returns false when the item is missing", () => {
    expect(scrollToShoppingItem("missing")).toBe(false);
  });

  it("skips scrollIntoView when the quick-add field is focused", () => {
    const item = document.createElement("div");
    item.setAttribute("data-shopping-source-key", "item-1");
    mockRect(item, { bottom: -20, top: -80 });
    const scrollIntoView = vi.fn();
    item.scrollIntoView = scrollIntoView;
    document.body.append(item);

    const root = document.createElement("div");
    root.setAttribute(SHOPPING_QUICK_ADD_ROOT_ATTRIBUTE, "");
    const input = document.createElement("input");
    root.append(input);
    document.body.append(root);
    input.focus();

    expect(scrollToShoppingItem("item-1")).toBe(true);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls when another control is focused and the item is off-screen", () => {
    const item = document.createElement("div");
    item.setAttribute("data-shopping-source-key", "item-1");
    mockRect(item, { bottom: -20, top: -80 });
    const scrollIntoView = vi.fn();
    item.scrollIntoView = scrollIntoView;
    document.body.append(item);

    const select = document.createElement("select");
    document.body.append(select);
    select.focus();

    expect(scrollToShoppingItem("item-1")).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  });
});
