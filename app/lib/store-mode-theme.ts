/** Nordic Playful palette for store mode — see docs/design/store-mode-concepts/nordic-playful.html */

export const storeModePageClass = "min-h-screen bg-stone-50 px-4 pb-36 pt-8 text-stone-900";

export const storeModeMetaStripClass =
  "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-stone-200";

export const storeModeProgressPillClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-store-accent-light px-2 py-0.5 text-sm font-semibold text-store-accent-text";

export const storeModeProgressDotClass =
  "size-1.5 shrink-0 rounded-full bg-store-accent-deep";

export const storeModeSurfaceCardClass =
  "rounded-[28px] bg-white shadow-sm ring-1 ring-stone-200";

export const storeModeSectionCardClass = `${storeModeSurfaceCardClass} p-5`;

export const storeModeMutedPanelClass = `${storeModeSurfaceCardClass} bg-stone-50/80 p-5`;

export const storeModeAccentBarClass =
  "mb-3 h-0.5 w-10 rounded-full bg-gradient-to-r from-store-accent-light to-store-accent";

export const storeModeSelectClass =
  "w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-store-accent focus:ring-4 focus:ring-store-accent-light/60 disabled:cursor-wait disabled:bg-stone-50";

const storeModeMetaSelectBase =
  "min-w-0 w-auto truncate rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 outline-none transition focus:border-store-accent focus:ring-4 focus:ring-store-accent-light/60 disabled:cursor-wait disabled:bg-stone-50";

export const storeModeMetaStoreSelectClass = `${storeModeMetaSelectBase} max-w-[11rem]`;

export const storeModeMetaDateSelectClass = `${storeModeMetaSelectBase} max-w-[9rem]`;

export const storeModeCountChipClass =
  "rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600";

export const storeModeLaterChipClass =
  "rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700";

export const storeModeQuickAddDockClass =
  "min-w-0 max-w-full rounded-[28px] bg-white p-4 shadow-2xl ring-2 ring-store-accent";

/** Fixed bottom stack (undo + quick-add) — out of document flow. */
export const storeModeBottomChromeShellClass =
  "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-3";

export const storeModeUndoBarClass =
  "flex min-h-11 items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 px-3 py-2 text-sm text-stone-900 shadow-lg backdrop-blur-sm";

export const storeModeUndoBarActionClass =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-store-accent-light px-3 text-sm font-semibold text-store-accent-text ring-1 ring-store-accent/40 transition hover:bg-store-accent-light/80";

export const storeModeUndoBarDismissClass =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-950";

export const storeModeHandletFoldClass =
  "rounded-2xl border border-stone-200/80 bg-stone-50/90 p-3";

export type StoreModeBannerTone = "success" | "sync" | "error";

export type StoreModeSyncOverlayTone = "sync" | "error";

/** Fixed shell under sticky app top nav — out of document flow to avoid list shift. */
export const storeModeSyncOverlayShellClass =
  "pointer-events-none fixed inset-x-0 top-16 z-[60] px-4";

export function getStoreModeBannerClass(tone: StoreModeBannerTone) {
  switch (tone) {
    case "success":
      return "rounded-[28px] border border-emerald-200/80 bg-emerald-50 px-6 py-5 text-emerald-950 shadow-sm";
    case "sync":
      return "rounded-[28px] border border-amber-200/80 bg-amber-50 px-6 py-5 text-amber-950 shadow-sm";
    case "error":
      return "rounded-[28px] border border-rose-200/80 bg-rose-50 px-6 py-5 text-rose-900 shadow-sm";
  }
}

export function getStoreModeSyncOverlayClass(tone: StoreModeSyncOverlayTone) {
  const base =
    "mx-auto max-w-4xl rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm";

  switch (tone) {
    case "sync":
      return `${base} border-amber-200/80 bg-amber-50/95 text-amber-950`;
    case "error":
      return `${base} border-rose-200/80 bg-rose-50/95 text-rose-900`;
  }
}
