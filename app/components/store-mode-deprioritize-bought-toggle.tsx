interface StoreModeDeprioritizeBoughtToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function StoreModeDeprioritizeBoughtToggle({
  enabled,
  onChange,
}: StoreModeDeprioritizeBoughtToggleProps) {
  return (
    <button
      aria-pressed={enabled}
      className={
        enabled
          ? "rounded-2xl bg-store-surface px-4 py-2.5 text-sm font-medium text-store-ink shadow-sm ring-1 ring-store-line"
          : "rounded-2xl bg-store-bg px-4 py-2.5 text-sm font-medium text-store-muted ring-1 ring-store-line transition hover:text-store-ink"
      }
      onClick={() => onChange(!enabled)}
      type="button"
    >
      Skjul kjøpte varer
    </button>
  );
}
