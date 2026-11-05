// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "../test/render-with-router";
import { ShoppingNotePaste } from "./shopping-note-paste";
import type { ShoppingNoteReviewItem } from "../lib/shopping-note";

const categories = [
  { displayName: "Annet", id: "cat-other" },
  { displayName: "Meieri", id: "cat-dairy" },
];

const proposedItems: ShoppingNoteReviewItem[] = [
  {
    categoryId: "cat-dairy",
    name: "Melk",
    quantity: "2 liter",
    resolvedIngredientId: null,
    resolvedName: "Melk",
  },
];

describe("ShoppingNotePaste", () => {
  it("keeps the pasted text when interpretation fails", () => {
    renderWithRouter(<PasteProbe />);

    fireEvent.change(screen.getByLabelText("Notat"), {
      target: { value: "2 liter melk og brød" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Feil" }));

    expect(screen.getByLabelText("Notat")).toHaveValue("2 liter melk og brød");
    expect(screen.getByText("Fant ingen varer i notatet.")).toBeInTheDocument();
  });

  it("shows the proposed category and submits the category the person picks", () => {
    renderWithRouter(<PasteProbe />);

    fireEvent.change(screen.getByLabelText("Notat"), {
      target: { value: "melk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Forslag" }));
    fireEvent.change(screen.getByLabelText("Kategori"), {
      target: { value: "cat-other" },
    });

    const itemsInput = document.querySelector(
      'input[name="items"]',
    ) as HTMLInputElement;
    const items = JSON.parse(itemsInput.value);

    expect(screen.getByLabelText("Kategori")).toHaveValue("cat-other");
    expect(items[0].categoryId).toBe("cat-other");
    expect(items[0].name).toBe("Melk");
  });

  it("disables submit when the last row is removed and can return to the note", () => {
    renderWithRouter(<PasteProbe />);

    fireEvent.change(screen.getByLabelText("Notat"), {
      target: { value: "melk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Forslag" }));
    fireEvent.click(screen.getByRole("button", { name: "Fjern" }));

    expect(screen.getByRole("button", { name: "Legg til på listen" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Tilbake til notatet" }));

    expect(screen.getByLabelText("Notat")).toHaveValue("melk");
  });

  it("does not ask to interpret an empty note", () => {
    const onInterpret = vi.fn();
    renderWithRouter(
      <ShoppingNotePaste
        categories={categories}
        confirmPending={false}
        familyId="family-1"
        familyName="Solberg"
        interpretPending={false}
        onInterpret={onInterpret}
        proposedItems={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tolke notatet" }));

    expect(onInterpret).not.toHaveBeenCalled();
    expect(screen.getByText("Lim inn et notat først.")).toBeInTheDocument();
  });
});

function PasteProbe() {
  const [interpretError, setInterpretError] = useState<string | undefined>();
  const [proposed, setProposed] = useState<ShoppingNoteReviewItem[] | null>(null);

  return (
    <>
      <button onClick={() => setInterpretError("Fant ingen varer i notatet.")} type="button">
        Feil
      </button>
      <button onClick={() => setProposed(proposedItems)} type="button">
        Forslag
      </button>
      <ShoppingNotePaste
        categories={categories}
        confirmPending={false}
        familyId="family-1"
        familyName="Solberg"
        interpretError={interpretError}
        interpretPending={false}
        onInterpret={vi.fn()}
        proposedItems={proposed}
      />
    </>
  );
}
