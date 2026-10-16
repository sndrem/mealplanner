interface HideCategoryHeadingsToggleProps {
  hidden: boolean;
  onChange: (showCategoryHeadings: boolean) => void;
  variant?: "store" | "surface";
}

export function HideCategoryHeadingsToggle({
  hidden,
  onChange,
  variant = "store",
}: HideCategoryHeadingsToggleProps) {
  const className =
    variant === "surface"
      ? hidden
        ? "rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white"
        : "rounded-2xl bg-surface px-5 py-3 text-sm font-medium text-ink ring-1 ring-line transition hover:bg-accent-soft"
      : hidden
        ? "rounded-2xl bg-store-surface px-4 py-2.5 text-sm font-medium text-store-ink shadow-sm ring-1 ring-store-line"
        : "rounded-2xl bg-store-bg px-4 py-2.5 text-sm font-medium text-store-muted ring-1 ring-store-line transition hover:text-store-ink";

  return (
    <button
      aria-pressed={hidden}
      className={className}
      onClick={() => onChange(hidden)}
      type="button"
    >
      Skjul kategorier
    </button>
  );
}
