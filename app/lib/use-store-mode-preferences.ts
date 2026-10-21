import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

import {
  buildStoreModeDeprioritizeBoughtStorageKey,
  buildStoreModeRecipeUrgencyStorageKey,
  buildStoreModeSinkFinishedSectionsStorageKey,
  buildStoreModeStockReminderDismissedStorageKey,
  buildStoreModeViewStorageKey,
  readStoreModeDeprioritizeBought,
  readStoreModeRecipeUrgency,
  readStoreModeShoppingView,
  readStoreModeSinkFinishedSections,
  readStoreModeStockReminderDismissed,
  writeSinkFinishedSectionsCookie,
  writeStoreModeDeprioritizeBought,
  writeStoreModeRecipeUrgency,
  writeStoreModeShoppingView,
  writeStoreModeSinkFinishedSections,
  writeStoreModeStockReminderDismissed,
  type StoreModeShoppingView,
} from "./shopping-store-mode-client";

export function useStoreModePreferences({
  familyId,
  initialSinkFinishedSections,
  mealPlanId,
}: {
  familyId: string;
  initialSinkFinishedSections: boolean;
  mealPlanId: string;
}) {
  const viewStorageKey = useMemo(
    () => buildStoreModeViewStorageKey({ familyId }),
    [familyId],
  );
  const deprioritizeBoughtStorageKey = useMemo(
    () => buildStoreModeDeprioritizeBoughtStorageKey({ familyId }),
    [familyId],
  );
  const recipeUrgencyStorageKey = useMemo(
    () => buildStoreModeRecipeUrgencyStorageKey({ familyId }),
    [familyId],
  );
  const sinkFinishedSectionsStorageKey = useMemo(
    () => buildStoreModeSinkFinishedSectionsStorageKey({ familyId }),
    [familyId],
  );
  const stockReminderDismissedStorageKey = useMemo(
    () =>
      buildStoreModeStockReminderDismissedStorageKey({
        familyId,
        mealPlanId,
      }),
    [familyId, mealPlanId],
  );
  const [shoppingView, setShoppingView] = useState<StoreModeShoppingView>(() =>
    readStoreModeShoppingView(viewStorageKey),
  );
  const [deprioritizeBought, setDeprioritizeBought] = useStoredFlag(
    deprioritizeBoughtStorageKey,
    readStoreModeDeprioritizeBought,
    writeStoreModeDeprioritizeBought,
  );
  const [showRecipeUrgency, setShowRecipeUrgency] = useStoredFlag(
    recipeUrgencyStorageKey,
    readStoreModeRecipeUrgency,
    writeStoreModeRecipeUrgency,
  );
  const [sinkFinishedSections, setSinkFinishedSections] = useState(
    initialSinkFinishedSections,
  );
  const [stockReminderDismissed, setStockReminderDismissed] = useStoredFlag(
    stockReminderDismissedStorageKey,
    readStoreModeStockReminderDismissed,
    writeStoreModeStockReminderDismissed,
  );
  const handleShoppingViewChange = useCallback(
    (nextView: StoreModeShoppingView) => {
      setShoppingView(nextView);
      writeStoreModeShoppingView(viewStorageKey, nextView);
    },
    [viewStorageKey],
  );
  const handleSinkFinishedSectionsChange = useCallback(
    (enabled: boolean) => {
      setSinkFinishedSections(enabled);
      writeStoreModeSinkFinishedSections(sinkFinishedSectionsStorageKey, enabled);
      writeSinkFinishedSectionsCookie(familyId, enabled);
    },
    [familyId, sinkFinishedSectionsStorageKey],
  );
  const handleDismissStockReminder = useCallback(() => {
    setStockReminderDismissed(true);
  }, [setStockReminderDismissed]);
  const handleRestoreStockReminder = useCallback(() => {
    setStockReminderDismissed(false);
  }, [setStockReminderDismissed]);

  useEffect(() => {
    setShoppingView(readStoreModeShoppingView(viewStorageKey));
  }, [viewStorageKey]);
  useLayoutEffect(() => {
    const stored = readStoreModeSinkFinishedSections(
      sinkFinishedSectionsStorageKey,
    );
    setSinkFinishedSections(stored);
    writeSinkFinishedSectionsCookie(familyId, stored);
  }, [familyId, sinkFinishedSectionsStorageKey]);

  return {
    deprioritizeBought,
    handleDeprioritizeBoughtChange: setDeprioritizeBought,
    handleDismissStockReminder,
    handleRecipeUrgencyChange: setShowRecipeUrgency,
    handleRestoreStockReminder,
    handleShoppingViewChange,
    handleSinkFinishedSectionsChange,
    shoppingView,
    showRecipeUrgency,
    sinkFinishedSections,
    stockReminderDismissed,
  };
}

function useStoredFlag(
  storageKey: string,
  read: (storageKey: string) => boolean,
  write: (storageKey: string, enabled: boolean) => void,
) {
  const [value, setValue] = useState(() => read(storageKey));
  const setStoredValue = useCallback(
    (next: boolean) => {
      setValue(next);
      write(storageKey, next);
    },
    [storageKey, write],
  );

  useEffect(() => {
    setValue(read(storageKey));
  }, [read, storageKey]);

  return [value, setStoredValue] as const;
}
