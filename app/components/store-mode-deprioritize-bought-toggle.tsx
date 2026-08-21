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
          ? "rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-stone-950 shadow-sm ring-1 ring-stone-200"
          : "rounded-2xl bg-stone-100 px-4 py-2.5 text-sm font-medium text-stone-600 ring-1 ring-stone-200 transition hover:text-stone-950"
      }
      onClick={() => onChange(!enabled)}
      type="button"
    >
      Skjul kjøpte varer
    </button>
  );
}
