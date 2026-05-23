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
          ? "rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950 shadow-sm ring-1 ring-slate-200"
          : "rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-slate-950"
      }
      onClick={() => onChange(!enabled)}
      type="button"
    >
      Flytt kjøpte varer til bunnen
    </button>
  );
}
