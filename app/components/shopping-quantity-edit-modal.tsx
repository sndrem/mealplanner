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
        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h3 className="text-sm font-semibold text-stone-950">Oppdater mengde</h3>
        <p className="mt-1 text-xs text-stone-600">{name}</p>
        <label className="mt-3 block text-xs font-medium text-stone-700">
          Mengde
          <input
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
        <p className="mt-2 text-xs leading-5 text-stone-500">
          La feltet stå tomt for å bruke mengden fra oppskriftene.
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          {canReset && onReset ? (
            <button
              className="rounded-xl px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100"
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
              className="rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
              onClick={onCancel}
              type="button"
            >
              Avbryt
            </button>
            <button
              className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
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
