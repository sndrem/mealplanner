import type { RefObject } from "react";

export function ShoppingQuantityEditModal({
  canReset = false,
  name,
  onCancel,
  onReset,
  onSave,
  quantity,
  quantityInputRef,
  setQuantity,
}: {
  canReset?: boolean;
  name: string;
  onCancel: () => void;
  onReset?: () => void;
  onSave: () => void;
  quantity: string;
  quantityInputRef: RefObject<HTMLInputElement | null>;
  setQuantity: (value: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 p-4"
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-store-line bg-surface p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h3 className="text-sm font-semibold text-store-ink">Oppdater mengde</h3>
        <p className="mt-1 text-xs text-store-muted">{name}</p>
        <label className="mt-3 block text-xs font-medium text-store-muted">
          Mengde
          <input
            className="mt-1 w-full rounded-xl border border-store-line bg-surface px-3 py-2 text-base text-store-ink outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            onChange={(event) => setQuantity(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
            placeholder="F.eks. 4 flasker"
            ref={quantityInputRef}
            type="text"
            value={quantity}
          />
        </label>
        <p className="mt-2 text-xs leading-5 text-store-muted">
          La feltet stå tomt for å bruke mengden fra oppskriftene.
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          {canReset && onReset ? (
            <button
              className="rounded-xl px-3 py-2 text-sm text-store-muted transition hover:bg-store-bg"
              onClick={onReset}
              type="button"
            >
              Tilbakestill
            </button>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <button
              className="rounded-xl border border-store-line px-3 py-2 text-sm text-store-muted transition hover:bg-store-bg"
              onClick={onCancel}
              type="button"
            >
              Avbryt
            </button>
            <button
              className="rounded-xl bg-store-ink px-3 py-2 text-sm font-medium text-store-bg transition hover:opacity-90"
              onClick={onSave}
              type="button"
            >
              Lagre
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
