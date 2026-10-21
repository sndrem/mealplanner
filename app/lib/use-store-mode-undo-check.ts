import { useCallback, useState } from "react";

export function useStoreModeUndoCheck<
  TItem extends { checked: boolean; name: string; sourceKey: string },
>({
  displayItemsBySourceKey,
  handleToggle,
}: {
  displayItemsBySourceKey: { get(sourceKey: string): TItem | undefined };
  handleToggle: (item: TItem) => void;
}) {
  const [lastCheckedAction, setLastCheckedAction] = useState<TItem | null>(null);
  const handleToggleWithUndoFeedback = useCallback(
    (item: TItem) => {
      const displayItem = displayItemsBySourceKey.get(item.sourceKey) ?? item;
      const nextChecked = !displayItem.checked;
      handleToggle(item);

      if (nextChecked) {
        setLastCheckedAction({
          ...displayItem,
          checked: true,
        });
        return;
      }

      setLastCheckedAction((current) =>
        current?.sourceKey === item.sourceKey ? null : current,
      );
    },
    [displayItemsBySourceKey, handleToggle],
  );
  const handleUndoLastCheck = useCallback(() => {
    if (!lastCheckedAction) {
      return;
    }

    handleToggle(lastCheckedAction);
    setLastCheckedAction(null);
  }, [handleToggle, lastCheckedAction]);
  const handleDismissLastCheck = useCallback(() => {
    setLastCheckedAction(null);
  }, []);

  return {
    handleDismissLastCheck,
    handleToggleWithUndoFeedback,
    handleUndoLastCheck,
    lastCheckedAction,
  };
}
