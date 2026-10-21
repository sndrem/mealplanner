import { StoreModePressedChip } from "./store-mode-pressed-chip";

interface StoreModeDeprioritizeBoughtToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function StoreModeDeprioritizeBoughtToggle({
  enabled,
  onChange,
}: StoreModeDeprioritizeBoughtToggleProps) {
  return (
    <StoreModePressedChip
      enabled={enabled}
      label="Skjul kjøpte varer"
      onChange={onChange}
    />
  );
}
