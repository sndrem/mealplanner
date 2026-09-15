/** Nordic Playful palette for store mode — see docs/design/store-mode-concepts/nordic-playful.html */

export const storeModePageClass = "min-h-screen bg-store-bg px-4 pb-36 pt-8 text-store-ink";

export const storeModeMetaStripClass =
  "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-store-surface px-4 py-3 text-sm shadow-sm ring-1 ring-store-line";

export const storeModeProgressPillClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-store-accent-light px-2 py-0.5 text-sm font-semibold text-store-accent-text";

export const storeModeProgressDotClass =
  "size-1.5 shrink-0 rounded-full bg-store-accent-deep";

export const storeModeSurfaceCardClass =
  "rounded-[28px] bg-store-surface shadow-sm ring-1 ring-store-line";

export const storeModeSectionCardClass = `${storeModeSurfaceCardClass} p-5`;

export const storeModeMutedPanelClass = `${storeModeSurfaceCardClass} bg-store-bg/80 p-5`;

export const storeModeAccentBarClass =
  "mb-3 h-0.5 w-10 rounded-full bg-gradient-to-r from-store-accent-light to-store-accent";

export const storeModeSelectClass =
  "w-full rounded-2xl border border-store-line bg-store-surface px-4 py-3 text-base text-store-ink outline-none transition focus:border-store-accent focus:ring-4 focus:ring-store-accent-light/60 disabled:cursor-wait disabled:bg-store-bg";

const storeModeMetaSelectBase =
  "min-w-0 w-auto truncate rounded-xl border border-store-line bg-store-surface px-3 py-1.5 text-base text-store-ink outline-none transition focus:border-store-accent focus:ring-4 focus:ring-store-accent-light/60 disabled:cursor-wait disabled:bg-store-bg";

export const storeModeMetaStoreSelectClass = `${storeModeMetaSelectBase} max-w-[11rem]`;

export const storeModeMetaDateSelectClass = `${storeModeMetaSelectBase} max-w-[9rem]`;

export const storeModeMetaTripFocusSelectClass = `${storeModeMetaSelectBase} max-w-[10rem]`;

export const storeModeCountChipClass =
  "rounded-full bg-store-bg px-3 py-1 text-xs font-medium text-store-muted";

export const storeModeLaterChipClass =
  "rounded-full bg-store-bg px-3 py-1.5 text-xs font-medium text-store-ink";

export const storeModeQuickAddDockClass =
  "min-w-0 max-w-full rounded-[28px] bg-store-surface p-4 shadow-2xl ring-2 ring-store-accent";

/** Fixed bottom stack (undo + quick-add) — out of document flow. */
export const storeModeBottomChromeShellClass =
  "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-3";

export const storeModeUndoBarClass =
  "flex min-h-11 items-center gap-3 rounded-2xl border border-store-line bg-store-surface/95 px-3 py-2 text-sm text-store-ink shadow-lg backdrop-blur-sm";

export const storeModeUndoBarActionClass =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-store-accent-light px-3 text-sm font-semibold text-store-accent-text ring-1 ring-store-accent/40 transition hover:bg-store-accent-light/80";

export const storeModeUndoBarDismissClass =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-store-muted transition hover:bg-store-bg hover:text-store-ink";

export const storeModeCompleteCelebrationChromeClass =
  "flex min-h-11 items-start gap-3 rounded-2xl border border-notice-success-line bg-notice-success/95 px-3 py-2.5 text-sm text-notice-success-ink shadow-lg backdrop-blur-sm";

export const storeModeCelebrationHighlightClass =
  "border border-notice-success-line bg-notice-success/40 motion-safe:animate-pulse motion-reduce:animate-none";

export const storeModeHandletFoldClass =
  "rounded-2xl border border-store-line/80 bg-store-bg/90 p-3";

export const storeModeStockReminderClass =
  "rounded-2xl bg-notice-warning px-3 py-2 shadow-sm ring-1 ring-notice-warning-line";

export const storeModeStockReminderChipClass =
  "rounded-full bg-notice-warning-line/30 px-3 py-1 text-xs font-medium text-notice-warning-ink";

export type StoreModeBannerTone = "success" | "sync" | "error";

export type StoreModeSyncOverlayTone = "sync" | "error";

/** Fixed shell under sticky app top nav — out of document flow to avoid list shift. */
export const storeModeSyncOverlayShellClass =
  "pointer-events-none fixed inset-x-0 top-16 z-[60] px-4";

export function getStoreModeBannerClass(tone: StoreModeBannerTone) {
  switch (tone) {
    case "success":
      return "rounded-[28px] border border-notice-success-line bg-notice-success px-6 py-5 text-notice-success-ink shadow-sm";
    case "sync":
      return "rounded-[28px] border border-notice-warning-line bg-notice-warning px-6 py-5 text-notice-warning-ink shadow-sm";
    case "error":
      return "rounded-[28px] border border-notice-danger-line bg-notice-danger px-6 py-5 text-notice-danger-ink shadow-sm";
  }
}

export function getStoreModeSyncOverlayClass(tone: StoreModeSyncOverlayTone) {
  const base =
    "mx-auto max-w-4xl rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm";

  switch (tone) {
    case "sync":
      return `${base} border-notice-warning-line bg-notice-warning/95 text-notice-warning-ink`;
    case "error":
      return `${base} border-notice-danger-line bg-notice-danger/95 text-notice-danger-ink`;
  }
}
