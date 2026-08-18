import type { StoreModeShoppingView } from "../lib/shopping-store-mode-client";

interface StoreModeShoppingViewToggleProps {
  onChange: (view: StoreModeShoppingView) => void;
  view: StoreModeShoppingView;
}

export function StoreModeShoppingViewToggle({
  onChange,
  view,
}: StoreModeShoppingViewToggleProps) {
  return (
    <div
      aria-label="Visning av handleliste"
      className="inline-flex rounded-2xl bg-stone-100 p-1 ring-1 ring-stone-200"
      role="radiogroup"
    >
      <button
        aria-checked={view === "grid"}
        className={
          view === "grid"
            ? "rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-stone-950 shadow-sm ring-1 ring-stone-200"
            : "rounded-xl px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:text-stone-950"
        }
        onClick={() => onChange("grid")}
        role="radio"
        type="button"
      >
        Rutenett
      </button>
      <button
        aria-checked={view === "list"}
        className={
          view === "list"
            ? "rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-stone-950 shadow-sm ring-1 ring-stone-200"
            : "rounded-xl px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:text-stone-950"
        }
        onClick={() => onChange("list")}
        role="radio"
        type="button"
      >
        Liste
      </button>
    </div>
  );
}
