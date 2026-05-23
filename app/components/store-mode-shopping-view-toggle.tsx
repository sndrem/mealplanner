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
      className="inline-flex rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200"
      role="radiogroup"
    >
      <button
        aria-checked={view === "list"}
        className={
          view === "list"
            ? "rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-sm ring-1 ring-slate-200"
            : "rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
        }
        onClick={() => onChange("list")}
        role="radio"
        type="button"
      >
        Liste
      </button>
      <button
        aria-checked={view === "grid"}
        className={
          view === "grid"
            ? "rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-sm ring-1 ring-slate-200"
            : "rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
        }
        onClick={() => onChange("grid")}
        role="radio"
        type="button"
      >
        Rutenett
      </button>
    </div>
  );
}
