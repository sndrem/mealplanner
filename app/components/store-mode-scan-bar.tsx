import { useId, useState, type ReactNode } from "react";

import { computeStoreModeScanProgress } from "../lib/shopping-store-mode-client";
import {
  storeModeScanBarClass,
  storeModeScanProgressFillClass,
  storeModeScanProgressTrackClass,
} from "../lib/store-mode-theme";

interface StoreModeScanBarProps {
  checkedCount: number;
  children: ReactNode;
  focusLabel: string;
  isCelebrating?: boolean;
  simpleView?: boolean;
  storeName: string;
  totalCount: number;
}

export function StoreModeScanBar({
  checkedCount,
  children,
  focusLabel,
  isCelebrating = false,
  simpleView = false,
  storeName,
  totalCount,
}: StoreModeScanBarProps) {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const scanProgress = computeStoreModeScanProgress({
    checkedCount,
    totalCount,
  });
  const pulseClass = isCelebrating ? " motion-safe:animate-pulse" : "";
  const tilpassButton = (
    <button
      aria-controls={panelId}
      aria-expanded={isOpen}
      className="shrink-0 text-xs font-semibold text-store-muted underline decoration-store-line underline-offset-2 hover:text-store-ink"
      onClick={() => {
        setIsOpen((open) => !open);
      }}
      type="button"
    >
      Tilpass
    </button>
  );

  return (
    <>
      <div className={storeModeScanBarClass}>
        <h1 className="sr-only">Butikkmodus</h1>
        {simpleView ? (
          <div className="flex justify-end">{tilpassButton}</div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className={`min-w-0 text-sm${pulseClass}`}>
                <span className="font-semibold text-store-accent-text">
                  {scanProgress.remainingCount} igjen
                </span>
                <span className="text-store-muted">
                  {" · "}
                  {checkedCount}/{totalCount} krysset av
                </span>
              </p>
              {tilpassButton}
            </div>
            <div
              aria-label="Handlefremdrift"
              aria-valuemax={totalCount}
              aria-valuemin={0}
              aria-valuenow={checkedCount}
              className={`${storeModeScanProgressTrackClass}${pulseClass}`}
              role="progressbar"
            >
              <div
                className={storeModeScanProgressFillClass}
                style={{ width: `${scanProgress.percent}%` }}
              />
            </div>
            <p className="mt-1 truncate text-xs text-store-muted">
              {storeName}
              <span aria-hidden="true"> · </span>
              {focusLabel}
            </p>
          </>
        )}
      </div>
      {isOpen ? (
        <div id={panelId}>
          {children}
        </div>
      ) : null}
    </>
  );
}
