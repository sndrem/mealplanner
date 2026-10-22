// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StoreModeShoppingItemCard } from "./store-mode-shopping-item-card";
import { formatDateOnly } from "../lib/meal-plan-dates";
import {
  storeModeRecipeUrgencySoonEdgeClass,
  storeModeRecipeUrgencyUpcomingEdgeClass,
} from "../lib/store-mode-theme";
import { renderWithRouter } from "../test/render-with-router";

function shiftDateOnly(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return formatDateOnly(shifted);
}

function cardBySourceKey(sourceKey: string) {
  return document.querySelector(`[data-shopping-source-key="${sourceKey}"]`);
}

function generatedItem(lastDate: string, name: string) {
  return {
    category: { id: "cat-dry", name: "Tørrvarer" },
    checked: false,
    collaborationVersion: "v1",
    isStockItem: false,
    firstDate: lastDate,
    lastDate,
    mealPlanId: "meal-plan-1",
    name,
    note: null,
    occurrenceCount: 1,
    occurrences: [
      {
        date: lastDate,
        quantityLabel: "1 ts",
        recipeTitle: "Taco",
      },
    ],
    postponedUntilDate: null,
    preferredStore: null,
    preferredStoreConflict: false,
    quantity: null,
    quantityLabel: "1 ts",
    recipeCount: 1,
    sourceKey: `entry:${lastDate}`,
    sourceType: "GENERATED" as const,
  };
}

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

  it("shows a decorative icon and keeps the check name", () => {
    renderWithRouter(
      <StoreModeShoppingItemCard
        item={familyItem}
        layout="grid"
        onToggle={vi.fn()}
        readOnly
        selectedStoreId="store-1"
      />,
    );

    const icon = document.querySelector("[data-shopping-item-icon]");

    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("data-shopping-item-icon", "milk");
    expect(
      screen.getByRole("button", { name: "Marker Melk som handlet" }),
    ).toBeInTheDocument();
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

    const quickAdd = screen.getByRole("button", { name: "Hurtiglegg til" });
    const details = quickAdd.closest("details");

    expect(quickAdd).toBeInTheDocument();
    expect(details).toHaveClass("open:w-full", "open:col-span-2");
    expect(details).not.toHaveClass("open:w-1/2");
  });

  it("shows grouped recipe measurements and hides quantity edit", () => {
    renderWithRouter(
      <StoreModeShoppingItemCard
        item={{
          category: { id: "cat-produce", name: "Frukt og gront" },
          checked: false,
          collaborationVersion: "v-group",
          groupingMembers: [
            {
              checked: false,
              collaborationVersion: "v1",
              mealPlanId: "meal-plan-1",
              quantity: null,
              quantityLabel: "1 fedd",
              sourceKey: "entry-1:ingredient-1",
            },
            {
              checked: false,
              collaborationVersion: "v2",
              mealPlanId: "meal-plan-1",
              quantity: null,
              quantityLabel: "2 stk",
              sourceKey: "entry-2:ingredient-2",
            },
            {
              checked: false,
              collaborationVersion: "v3",
              mealPlanId: "meal-plan-1",
              quantity: null,
              quantityLabel: null,
              sourceKey: "entry-3:ingredient-3",
            },
          ],
          firstDate: "2026-05-15",
          isStockItem: false,
          lastDate: "2026-05-17",
          mealPlanId: "meal-plan-1",
          mealPlanTitle: "Helgehandel",
          name: "Hvitlok",
          note: null,
          occurrenceCount: 3,
          occurrences: [
            {
              date: "2026-05-15",
              quantityLabel: "1 fedd",
              recipeTitle: "Pasta",
            },
            {
              date: "2026-05-16",
              quantityLabel: "2 stk",
              recipeTitle: "Taco",
            },
            {
              date: "2026-05-17",
              quantityLabel: null,
              recipeTitle: "Salat",
            },
          ],
          postponedUntilDate: null,
          preferredStore: null,
          preferredStoreConflict: false,
          quantity: null,
          quantityLabel: null,
          recipeCount: 3,
          sourceKey: "entry-1:ingredient-1|entry-2:ingredient-2",
          sourceType: "GENERATED",
        }}
        layout="grid"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
      />,
    );

    expect(screen.queryByText("Sett mengde")).not.toBeInTheDocument();
    expect(screen.getByText("Varierende mengder")).toBeInTheDocument();
    expect(screen.getByText("Helgehandel")).toBeInTheDocument();
    expect(screen.getByText("3 oppskrifter")).toBeInTheDocument();
    expect(screen.queryByText(/Ukeplan:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Brukt i/)).not.toBeInTheDocument();
    expect(
      screen.getByText("fredag 15. mai: Pasta · 1 fedd"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("lørdag 16. mai: Taco · 2 stk"),
    ).toBeInTheDocument();
    expect(screen.getByText("søndag 17. mai: Salat")).toBeInTheDocument();
  });

  it("lets an admin mark a generated item as a basisvare", () => {
    renderWithRouter(
      <StoreModeShoppingItemCard
        canMarkAsStock
        item={{
          category: { id: "cat-dry", name: "Tørrvarer" },
          checked: false,
          collaborationVersion: "v1",
          isStockItem: false,
          firstDate: "2026-05-15",
          lastDate: "2026-05-15",
          mealPlanId: "meal-plan-1",
          name: "Salt",
          note: null,
          occurrenceCount: 1,
          occurrences: [
            {
              date: "2026-05-15",
              quantityLabel: "1 ts",
              recipeTitle: "Taco",
            },
          ],
          postponedUntilDate: null,
          preferredStore: null,
          preferredStoreConflict: false,
          quantity: null,
          quantityLabel: "1 ts",
          recipeCount: 1,
          sourceKey: "entry-1:line-1",
          sourceType: "GENERATED",
        }}
        layout="grid"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
      />,
    );

    const markButton = screen.getByRole("button", {
      hidden: true,
      name: "Merk som basisvare",
    });
    expect(markButton.closest("details")).not.toHaveAttribute("open");

    fireEvent.click(screen.getByLabelText("Vis informasjon om Salt"));
    fireEvent.click(screen.getByRole("button", { name: "Merk som basisvare" }));

    expect(
      screen.getByText(/Salt blir en basisvare og holdes utenfor handlelisten/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Avbryt" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Fjern fra handlelisten" }),
    ).not.toBeInTheDocument();
  });

  it("shows mark-as-stock on family items for admins", () => {
    renderWithRouter(
      <StoreModeShoppingItemCard
        canMarkAsStock
        item={familyItem}
        layout="grid"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
      />,
    );

    const markButton = screen.getByRole("button", {
      hidden: true,
      name: "Merk som basisvare",
    });
    expect(markButton.closest("details")).not.toHaveAttribute("open");

    fireEvent.click(screen.getByLabelText("Vis informasjon om Melk"));

    expect(markButton.closest("details")).toHaveAttribute("open");
  });

  it("hides mark-as-stock for non-admins, manual items, and read-only cards", () => {
    const { unmount } = renderWithRouter(
      <StoreModeShoppingItemCard
        item={{
          category: { id: "cat-dry", name: "Tørrvarer" },
          checked: false,
          collaborationVersion: "v1",
          isStockItem: false,
          firstDate: "2026-05-15",
          lastDate: "2026-05-15",
          mealPlanId: "meal-plan-1",
          name: "Salt",
          note: null,
          occurrenceCount: 1,
          occurrences: [],
          postponedUntilDate: null,
          preferredStore: null,
          preferredStoreConflict: false,
          quantity: null,
          quantityLabel: null,
          recipeCount: 1,
          sourceKey: "entry-1:line-1",
          sourceType: "GENERATED",
        }}
        layout="grid"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
      />,
    );

    expect(
      screen.queryByRole("button", {
        hidden: true,
        name: "Merk som basisvare",
      }),
    ).not.toBeInTheDocument();
    unmount();

    const manualRender = renderWithRouter(
      <StoreModeShoppingItemCard
        canMarkAsStock
        item={{
          buyOnDate: "2026-05-15",
          category: { id: "cat-dry", name: "Tørrvarer" },
          checked: false,
          collaborationVersion: "v1",
          mealPlanId: "meal-plan-1",
          name: "Kaffe",
          note: null,
          preferredStore: null,
          quantity: null,
          quantityLabel: null,
          sourceKey: "manual-1",
          sourceType: "MANUAL",
        }}
        layout="grid"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
      />,
    );

    expect(
      screen.queryByRole("button", {
        hidden: true,
        name: "Merk som basisvare",
      }),
    ).not.toBeInTheDocument();
    manualRender.unmount();

    renderWithRouter(
      <StoreModeShoppingItemCard
        canMarkAsStock
        item={{
          category: { id: "cat-dry", name: "Tørrvarer" },
          checked: false,
          collaborationVersion: "v1",
          isStockItem: false,
          firstDate: "2026-05-15",
          lastDate: "2026-05-15",
          mealPlanId: "meal-plan-1",
          name: "Salt",
          note: null,
          occurrenceCount: 1,
          occurrences: [],
          postponedUntilDate: null,
          preferredStore: null,
          preferredStoreConflict: false,
          quantity: null,
          quantityLabel: null,
          recipeCount: 1,
          sourceKey: "entry-1:line-1",
          sourceType: "GENERATED",
        }}
        layout="grid"
        onToggle={vi.fn()}
        readOnly
        selectedStoreId="store-1"
      />,
    );

    expect(
      screen.queryByRole("button", {
        hidden: true,
        name: "Merk som basisvare",
      }),
    ).not.toBeInTheDocument();
  });

  it("prefixes a date in the coming week with kommende", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-11T08:00:00.000Z"));

    try {
      const { unmount } = renderWithRouter(
        <StoreModeShoppingItemCard
          item={generatedItem("2026-05-22", "Salt")}
          layout="grid"
          onToggle={vi.fn()}
          selectedStoreId="store-1"
        />,
      );

      expect(
        screen.getByText("Fra Taco fram til kommende fredag 22. mai."),
      ).toBeInTheDocument();
      unmount();

      renderWithRouter(
        <StoreModeShoppingItemCard
          item={generatedItem("2026-05-15", "Pepper")}
          layout="grid"
          onToggle={vi.fn()}
          selectedStoreId="store-1"
        />,
      );

      expect(
        screen.getByText("Fra Taco fram til fredag 15. mai."),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses notice-success tokens for the recently added highlight", () => {
    renderWithRouter(
      <StoreModeShoppingItemCard
        isRecentlyAdded
        item={familyItem}
        layout="grid"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
      />,
    );

    expect(
      document.querySelector(`[data-shopping-source-key="${familyItem.sourceKey}"]`),
    ).toHaveClass("border-notice-success-line", "bg-notice-success");
  });

  it("marks tomorrow's unbought recipe item when urgency is on", () => {
    const today = formatDateOnly(new Date());
    const item = {
      ...generatedItem(shiftDateOnly(today, 6), "Melk"),
      firstDate: shiftDateOnly(today, 1),
    };

    renderWithRouter(
      <StoreModeShoppingItemCard
        item={item}
        layout="list"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
        showRecipeUrgency
      />,
    );

    expect(screen.getByText("i morgen")).toBeInTheDocument();
    expect(cardBySourceKey(item.sourceKey)).toHaveClass(
      ...storeModeRecipeUrgencySoonEdgeClass.split(" "),
    );
  });

  it("uses a lighter edge without a label for items needed in a few days", () => {
    const today = formatDateOnly(new Date());
    const item = generatedItem(shiftDateOnly(today, 3), "Ris");

    renderWithRouter(
      <StoreModeShoppingItemCard
        item={item}
        layout="list"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
        showRecipeUrgency
      />,
    );

    expect(screen.queryByText("i dag")).not.toBeInTheDocument();
    expect(screen.queryByText("i morgen")).not.toBeInTheDocument();
    expect(cardBySourceKey(item.sourceKey)).toHaveClass(
      ...storeModeRecipeUrgencyUpcomingEdgeClass.split(" "),
    );
  });

  it("keeps the normal card when urgency is off or the item should stay plain", () => {
    const today = formatDateOnly(new Date());
    const tomorrow = shiftDateOnly(today, 1);
    const plain = generatedItem(tomorrow, "Melk");
    const checked = { ...plain, checked: true, sourceKey: "checked-milk" };
    const postponed = {
      ...plain,
      postponedUntilDate: tomorrow,
      sourceKey: "postponed-milk",
    };
    const undated = { ...plain, firstDate: null, sourceKey: "undated-milk" };
    const manual = {
      buyOnDate: tomorrow,
      category: { id: "cat-dry", name: "Tørrvarer" },
      checked: false,
      collaborationVersion: "v1",
      mealPlanId: "meal-plan-1",
      name: "Kaffe",
      note: null,
      preferredStore: null,
      quantity: null,
      quantityLabel: null,
      sourceKey: "manual-coffee",
      sourceType: "MANUAL" as const,
    };

    const { unmount } = renderWithRouter(
      <StoreModeShoppingItemCard
        item={plain}
        layout="list"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
      />,
    );
    expect(screen.queryByText("i morgen")).not.toBeInTheDocument();
    expect(cardBySourceKey(plain.sourceKey)).not.toHaveClass("border-l-4");
    unmount();

    for (const item of [checked, postponed, undated, manual, familyItem]) {
      const view = renderWithRouter(
        <StoreModeShoppingItemCard
          item={item}
          layout="list"
          onToggle={vi.fn()}
          selectedStoreId="store-1"
          showRecipeUrgency
        />,
      );
      expect(screen.queryByText("i dag")).not.toBeInTheDocument();
      expect(screen.queryByText("i morgen")).not.toBeInTheDocument();
      expect(cardBySourceKey(item.sourceKey)).not.toHaveClass("border-l-4");
      view.unmount();
    }
  });

  it("lets the recently added highlight win over the urgency edge", () => {
    const today = formatDateOnly(new Date());
    const item = generatedItem(shiftDateOnly(today, 1), "Melk");

    renderWithRouter(
      <StoreModeShoppingItemCard
        isRecentlyAdded
        item={item}
        layout="list"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
        showRecipeUrgency
      />,
    );

    expect(screen.queryByText("i morgen")).not.toBeInTheDocument();
    expect(cardBySourceKey(item.sourceKey)).toHaveClass(
      "border-notice-success-line",
      "bg-notice-success",
    );
    expect(cardBySourceKey(item.sourceKey)).not.toHaveClass("border-l-4");
  });

  it("shows a tile face in enkel visning and keeps the urgency edge without the day label", () => {
    const today = formatDateOnly(new Date());
    const item = {
      ...generatedItem(shiftDateOnly(today, 6), "Melk"),
      firstDate: shiftDateOnly(today, 1),
      quantityLabel: "2 l",
    };

    renderWithRouter(
      <StoreModeShoppingItemCard
        item={item}
        layout="grid"
        onToggle={vi.fn()}
        selectedStoreId="store-1"
        showRecipeUrgency
        simpleView
      />,
    );

    expect(screen.getByText("Melk")).toHaveClass("text-base");
    expect(screen.getByRole("button", { name: "2 l" })).toBeInTheDocument();
    expect(screen.queryByText("i morgen")).not.toBeInTheDocument();
    expect(document.querySelector("[data-shopping-item-icon]")).not.toBeInTheDocument();
    expect(cardBySourceKey(item.sourceKey)).toHaveClass(
      ...storeModeRecipeUrgencySoonEdgeClass.split(" "),
    );

    fireEvent.click(screen.getByLabelText("Vis informasjon om Melk"));

    expect(screen.getByText(/Fra Taco/)).toBeInTheDocument();
  });
});
