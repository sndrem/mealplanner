import { StoreModePressedChip } from "./store-mode-pressed-chip";

interface StoreModeSinkFinishedSectionsToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function StoreModeSinkFinishedSectionsToggle({
  enabled,
  onChange,
}: StoreModeSinkFinishedSectionsToggleProps) {
  return (
    <StoreModePressedChip
      enabled={enabled}
      label="Ferdige seksjoner nederst"
      onChange={onChange}
    />
  );
}
