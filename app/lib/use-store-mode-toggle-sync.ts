import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FetcherWithComponents } from "react-router";

import {
  applyToggleOpsToItems,
  areToggleQueuesEqual,
  buildStoreModeQueueStorageKey,
  getToggleExpectedVersion,
  readStoreModeToggleQueue,
  reconcileToggleQueue,
  removeToggleOp,
  type StoreModeToggleItem,
  type StoreModeToggleOp,
  upsertToggleOp,
  writeStoreModeToggleQueue,
} from "./shopping-store-mode-client";

const SYNC_RETRY_DELAY_MS = 2000;
const SYNC_BANNER_DELAY_MS = 800;

export const STORE_MODE_SYNC_PROGRESS_MESSAGE = "Synkroniserer avkryssinger…";

interface StoreModeToggleActionData {
  formError?: string;
  intent?: string;
  ok?: boolean;
}

interface UseStoreModeToggleSyncOptions<T extends StoreModeToggleItem> {
  activeShoppingDate: string;
  familyId: string;
  loaderItems: T[];
  mealPlanId: string;
  revalidate: () => void;
  toggleFetcher: FetcherWithComponents<StoreModeToggleActionData>;
}

export function useStoreModeToggleSync<T extends StoreModeToggleItem>({
  activeShoppingDate,
  familyId,
  loaderItems,
  mealPlanId,
  revalidate,
  toggleFetcher,
}: UseStoreModeToggleSyncOptions<T>) {
  const storageKey = useMemo(
    () =>
      buildStoreModeQueueStorageKey({
        activeShoppingDate,
        familyId,
        mealPlanId,
      }),
    [activeShoppingDate, familyId, mealPlanId],
  );
  const [queue, setQueue] = useState<StoreModeToggleOp[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showSyncProgressBanner, setShowSyncProgressBanner] = useState(false);
  const queueRef = useRef(queue);
  const inFlightSourceKeyRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const lastProcessedFetcherStateRef = useRef(toggleFetcher.state);
  const toggleFetcherRef = useRef(toggleFetcher);
  const revalidateRef = useRef(revalidate);
  const storageKeyRef = useRef(storageKey);
  const loaderItemsRef = useRef(loaderItems);

  toggleFetcherRef.current = toggleFetcher;
  revalidateRef.current = revalidate;
  storageKeyRef.current = storageKey;
  loaderItemsRef.current = loaderItems;
  queueRef.current = queue;

  const persistQueue = useCallback((nextQueue: StoreModeToggleOp[]) => {
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    writeStoreModeToggleQueue(storageKeyRef.current, nextQueue);
  }, []);

  const submitNextOp = useCallback(() => {
    const fetcher = toggleFetcherRef.current;

    if (fetcher.state !== "idle" || queueRef.current.length === 0) {
      return;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    const [nextOp] = queueRef.current;
    inFlightSourceKeyRef.current = nextOp.sourceKey;
    const formData = new FormData();
    formData.set(
      "intent",
      nextOp.sourceType === "FAMILY"
        ? "toggle-family-shopping-item-checked"
        : "toggle-shopping-item-checked",
    );
    formData.set("sourceKey", nextOp.sourceKey);
    formData.set("sourceType", nextOp.sourceType);
    formData.set("checked", nextOp.checked ? "true" : "false");
    formData.set("expectedUpdatedAt", nextOp.expectedUpdatedAt);
    fetcher.submit(formData, { method: "post" });
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
    }

    retryTimeoutRef.current = window.setTimeout(() => {
      retryTimeoutRef.current = null;
      submitNextOp();
    }, SYNC_RETRY_DELAY_MS);
  }, [submitNextOp]);

  const applyReconciledQueue = useCallback(
    (reconciledQueue: StoreModeToggleOp[]) => {
      if (areToggleQueuesEqual(reconciledQueue, queueRef.current)) {
        return;
      }

      persistQueue(reconciledQueue);
    },
    [persistQueue],
  );

  useEffect(() => {
    const storedQueue = readStoreModeToggleQueue(storageKey);
    const reconciledQueue = reconcileToggleQueue({
      loaderItems: loaderItemsRef.current,
      queue: storedQueue,
    });
    queueRef.current = reconciledQueue;
    setQueue(reconciledQueue);
    writeStoreModeToggleQueue(storageKey, reconciledQueue);
    setSyncError(null);
  }, [storageKey]);

  useEffect(() => {
    const reconciledQueue = reconcileToggleQueue({
      loaderItems,
      queue: queueRef.current,
    });
    applyReconciledQueue(reconciledQueue);
  }, [applyReconciledQueue, loaderItems]);

  const displayItems = useMemo(
    () => applyToggleOpsToItems(loaderItems, queue),
    [loaderItems, queue],
  );

  const displayItemsBySourceKey = useMemo(
    () => new Map(displayItems.map((item) => [item.sourceKey, item])),
    [displayItems],
  );

  useEffect(() => {
    submitNextOp();
  }, [queue, submitNextOp]);

  useEffect(() => {
    const previousState = lastProcessedFetcherStateRef.current;
    lastProcessedFetcherStateRef.current = toggleFetcher.state;

    if (previousState === "submitting" && toggleFetcher.state === "idle") {
      const submittedSourceKeyValue = inFlightSourceKeyRef.current;
      inFlightSourceKeyRef.current = null;

      if (toggleFetcher.data?.ok) {
        const nextQueue = submittedSourceKeyValue
          ? removeToggleOp(queueRef.current, submittedSourceKeyValue)
          : queueRef.current.slice(1);
        persistQueue(nextQueue);
        setSyncError(null);

        if (nextQueue.length === 0) {
          revalidateRef.current();
        } else {
          submitNextOp();
        }

        return;
      }

      if (toggleFetcher.data?.formError) {
        const nextQueue = submittedSourceKeyValue
          ? removeToggleOp(queueRef.current, submittedSourceKeyValue)
          : queueRef.current.slice(1);
        persistQueue(nextQueue);
        setSyncError(toggleFetcher.data.formError);
        revalidateRef.current();
        scheduleRetry();
        return;
      }

      if (submittedSourceKeyValue) {
        const nextQueue = removeToggleOp(queueRef.current, submittedSourceKeyValue);
        persistQueue(nextQueue);
        setSyncError(
          "Kunne ikke synkronisere. Prøver igjen når nettet er tilbake.",
        );
        scheduleRetry();
      }
    }
  }, [
    persistQueue,
    scheduleRetry,
    submitNextOp,
    toggleFetcher.data,
    toggleFetcher.state,
  ]);

  useEffect(() => {
    function handleConnectivityChange() {
      if (navigator.onLine) {
        setSyncError(null);
        submitNextOp();
      }
    }

    window.addEventListener("online", handleConnectivityChange);
    window.addEventListener("offline", handleConnectivityChange);
    window.addEventListener("visibilitychange", handleConnectivityChange);

    return () => {
      window.removeEventListener("online", handleConnectivityChange);
      window.removeEventListener("offline", handleConnectivityChange);
      window.removeEventListener("visibilitychange", handleConnectivityChange);

      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [submitNextOp]);

  const handleToggle = useCallback(
    (item: T) => {
      const displayItem = displayItemsBySourceKey.get(item.sourceKey) ?? item;
      const checked = !displayItem.checked;
      const op: StoreModeToggleOp = {
        checked,
        expectedUpdatedAt: getToggleExpectedVersion(displayItem),
        sourceKey: item.sourceKey,
        sourceType: item.sourceType,
      };
      const nextQueue = upsertToggleOp(queueRef.current, op);
      persistQueue(nextQueue);
      setSyncError(null);
      submitNextOp();
    },
    [displayItemsBySourceKey, persistQueue, submitNextOp],
  );

  const isSyncing = queue.length > 0;

  useEffect(() => {
    if (syncError || !isSyncing) {
      setShowSyncProgressBanner(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSyncProgressBanner(true);
    }, SYNC_BANNER_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSyncing, syncError]);

  const syncBannerMessage =
    syncError ??
    (showSyncProgressBanner ? STORE_MODE_SYNC_PROGRESS_MESSAGE : null);

  return {
    displayItems,
    displayItemsBySourceKey,
    handleToggle,
    isSyncing,
    queue,
    syncBannerMessage,
    syncError,
  };
}
