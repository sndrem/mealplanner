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
  writeStoreModeDeprioritizeBought,
  writeStoreModeRecipeUrgency,
  writeStoreModeShoppingView,
  writeStoreModeSinkFinishedSections,
  writeStoreModeStockReminderDismissed,
  type StoreModeShoppingView,
} from "./shopping-store-mode-client";

export function useStoreModePreferences({
  familyId,
  mealPlanId,
}: {
  familyId: string;
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
  const [deprioritizeBought, setDeprioritizeBought] = useState(() =>
    readStoreModeDeprioritizeBought(deprioritizeBoughtStorageKey),
  );
  const [showRecipeUrgency, setShowRecipeUrgency] = useState(() =>
    readStoreModeRecipeUrgency(recipeUrgencyStorageKey),
  );
  const [sinkFinishedSections, setSinkFinishedSections] = useState(() =>
    readStoreModeSinkFinishedSections(sinkFinishedSectionsStorageKey),
  );
  const [stockReminderDismissed, setStockReminderDismissed] = useState(() =>
    readStoreModeStockReminderDismissed(stockReminderDismissedStorageKey),
  );
  const handleShoppingViewChange = useCallback(
    (nextView: StoreModeShoppingView) => {
      setShoppingView(nextView);
      writeStoreModeShoppingView(viewStorageKey, nextView);
    },
    [viewStorageKey],
  );
  const handleDeprioritizeBoughtChange = useCallback(
    (enabled: boolean) => {
      setDeprioritizeBought(enabled);
      writeStoreModeDeprioritizeBought(deprioritizeBoughtStorageKey, enabled);
    },
    [deprioritizeBoughtStorageKey],
  );
  const handleRecipeUrgencyChange = useCallback(
    (enabled: boolean) => {
      setShowRecipeUrgency(enabled);
      writeStoreModeRecipeUrgency(recipeUrgencyStorageKey, enabled);
    },
    [recipeUrgencyStorageKey],
  );
  const handleSinkFinishedSectionsChange = useCallback(
    (enabled: boolean) => {
      setSinkFinishedSections(enabled);
      writeStoreModeSinkFinishedSections(
        sinkFinishedSectionsStorageKey,
        enabled,
      );
    },
    [sinkFinishedSectionsStorageKey],
  );
  const handleDismissStockReminder = useCallback(() => {
    setStockReminderDismissed(true);
    writeStoreModeStockReminderDismissed(stockReminderDismissedStorageKey, true);
  }, [stockReminderDismissedStorageKey]);
  const handleRestoreStockReminder = useCallback(() => {
    setStockReminderDismissed(false);
    writeStoreModeStockReminderDismissed(
      stockReminderDismissedStorageKey,
      false,
    );
  }, [stockReminderDismissedStorageKey]);

  useEffect(() => {
    setShoppingView(readStoreModeShoppingView(viewStorageKey));
  }, [viewStorageKey]);
  useEffect(() => {
    setDeprioritizeBought(
      readStoreModeDeprioritizeBought(deprioritizeBoughtStorageKey),
    );
  }, [deprioritizeBoughtStorageKey]);
  useEffect(() => {
    setShowRecipeUrgency(readStoreModeRecipeUrgency(recipeUrgencyStorageKey));
  }, [recipeUrgencyStorageKey]);
  useLayoutEffect(() => {
    // Read before paint so a reload does not leave finished sections in the walk.
    setSinkFinishedSections(
      readStoreModeSinkFinishedSections(sinkFinishedSectionsStorageKey),
    );
  }, [sinkFinishedSectionsStorageKey]);
  useEffect(() => {
    setStockReminderDismissed(
      readStoreModeStockReminderDismissed(stockReminderDismissedStorageKey),
    );
  }, [stockReminderDismissedStorageKey]);

  return {
    deprioritizeBought,
    handleDeprioritizeBoughtChange,
    handleDismissStockReminder,
    handleRecipeUrgencyChange,
    handleRestoreStockReminder,
    handleShoppingViewChange,
    handleSinkFinishedSectionsChange,
    shoppingView,
    showRecipeUrgency,
    sinkFinishedSections,
    stockReminderDismissed,
  };
}
