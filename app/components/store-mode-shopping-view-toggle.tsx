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
      className="inline-flex rounded-2xl bg-store-bg p-1 ring-1 ring-store-line"
      role="radiogroup"
    >
      <button
        aria-checked={view === "grid"}
        className={
          view === "grid"
            ? "rounded-xl bg-store-surface px-4 py-2.5 text-sm font-medium text-store-ink shadow-sm ring-1 ring-store-line"
            : "rounded-xl px-4 py-2.5 text-sm font-medium text-store-muted transition hover:text-store-ink"
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
            ? "rounded-xl bg-store-surface px-4 py-2.5 text-sm font-medium text-store-ink shadow-sm ring-1 ring-store-line"
            : "rounded-xl px-4 py-2.5 text-sm font-medium text-store-muted transition hover:text-store-ink"
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
