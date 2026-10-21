import { StoreModePressedChip } from "./store-mode-pressed-chip";

interface StoreModeRecipeUrgencyToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function StoreModeRecipeUrgencyToggle({
  enabled,
  onChange,
}: StoreModeRecipeUrgencyToggleProps) {
  return (
    <StoreModePressedChip
      enabled={enabled}
      label="Farge etter bruk"
      onChange={onChange}
    />
  );
}
