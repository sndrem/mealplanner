import { useEffect, useRef, useState } from "react";

import {
  detectShoppingListJustCompleted,
  getUncheckedCount,
  type ShoppingListProgress,
} from "./shopping-list-completion.client";

export function useShoppingListCompletionCelebration(
  progress: ShoppingListProgress,
) {
  const previousProgressRef = useRef<ShoppingListProgress | null>(null);
  const [isCelebrating, setIsCelebrating] = useState(false);

  useEffect(() => {
    const previousProgress = previousProgressRef.current;

    if (detectShoppingListJustCompleted(previousProgress, progress)) {
      setIsCelebrating(true);
    }

    if (getUncheckedCount(progress) > 0) {
      setIsCelebrating(false);
    }

    previousProgressRef.current = progress;
  }, [progress]);

  const dismissCelebration = () => {
    setIsCelebrating(false);
  };

  return {
    dismissCelebration,
    isCelebrating,
  };
}
