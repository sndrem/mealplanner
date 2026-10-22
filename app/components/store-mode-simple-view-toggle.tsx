import { StoreModePressedChip } from "./store-mode-pressed-chip";

interface StoreModeSimpleViewToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function StoreModeSimpleViewToggle({
  enabled,
  onChange,
}: StoreModeSimpleViewToggleProps) {
  return (
    <StoreModePressedChip
      enabled={enabled}
      label="Enkel visning"
      onChange={onChange}
    />
  );
}
