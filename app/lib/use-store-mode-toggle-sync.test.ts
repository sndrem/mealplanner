// @vitest-environment jsdom

import { ShoppingItemSource } from "@prisma/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMemo, useState } from "react";
import type { FetcherWithComponents } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildStoreModeQueueStorageKey,
  writeStoreModeToggleQueue,
} from "./shopping-store-mode-client";
import { useStoreModeToggleSync } from "./use-store-mode-toggle-sync";

const syncContext = {
  activeShoppingDate: "2026-05-16",
  familyId: "family-1",
  mealPlanId: "meal-plan-1",
};

const storageKey = buildStoreModeQueueStorageKey(syncContext);

const loaderItem = {
  checked: false,
  collaborationVersion: "2026-05-01T12:00:00.000Z",
  sourceKey: "entry-1:ingredient-1",
  sourceType: ShoppingItemSource.GENERATED,
} as const;

const queueOp = {
  checked: true,
  expectedUpdatedAt: "2026-05-01T12:00:00.000Z",
  sourceKey: loaderItem.sourceKey,
  sourceType: loaderItem.sourceType,
};

type ToggleFetcherData = {
  formError?: string;
  ok?: boolean;
};

type ToggleFetcherState = "idle" | "submitting" | "loading";

function useToggleSyncTestHarness({
  initialFetcherState = "idle" as ToggleFetcherState,
} = {}) {
  const [fetcherState, setFetcherState] =
    useState<ToggleFetcherState>(initialFetcherState);
  const [fetcherData, setFetcherData] = useState<ToggleFetcherData | undefined>(
    undefined,
  );
  const [submit] = useState(() =>
    vi.fn(async () => {
      setFetcherState("submitting");
    }),
  );

  const toggleFetcher = useMemo(
    () =>
      ({
        state: fetcherState,
        data: fetcherData,
        submit,
        Form: () => null,
        load: vi.fn(),
      }) as unknown as FetcherWithComponents<ToggleFetcherData>,
    [fetcherData, fetcherState, submit],
  );

  const revalidate = vi.fn();

  const sync = useStoreModeToggleSync({
    ...syncContext,
    loaderItems: [loaderItem],
    revalidate,
    toggleFetcher,
  });

  return {
    ...sync,
    revalidate,
    setFetcherData,
    setFetcherState,
    submit,
  };
}

describe("useStoreModeToggleSync", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("drains the queue when the fetcher settles via loading to idle", async () => {
    writeStoreModeToggleQueue(storageKey, [queueOp]);

    const { result } = renderHook(() => useToggleSyncTestHarness());

    await waitFor(() => {
      expect(result.current.submit).toHaveBeenCalled();
    });

    act(() => {
      result.current.setFetcherState("loading");
    });

    act(() => {
      result.current.setFetcherData({ ok: true });
      result.current.setFetcherState("idle");
    });

    await waitFor(() => {
      expect(result.current.queue).toEqual([]);
      expect(result.current.isSyncing).toBe(false);
    });
  });

  it("drains the queue when the fetcher settles directly from submitting to idle", async () => {
    writeStoreModeToggleQueue(storageKey, [queueOp]);

    const { result } = renderHook(() => useToggleSyncTestHarness());

    await waitFor(() => {
      expect(result.current.submit).toHaveBeenCalled();
    });

    act(() => {
      result.current.setFetcherData({ ok: true });
      result.current.setFetcherState("idle");
    });

    await waitFor(() => {
      expect(result.current.queue).toEqual([]);
      expect(result.current.isSyncing).toBe(false);
    });
  });

  it("ignores loading to idle when no toggle submission is in flight", async () => {
    writeStoreModeToggleQueue(storageKey, [queueOp]);

    const { result } = renderHook(() =>
      useToggleSyncTestHarness({ initialFetcherState: "loading" }),
    );

    await waitFor(() => {
      expect(result.current.queue).toEqual([queueOp]);
      expect(result.current.submit).not.toHaveBeenCalled();
    });

    act(() => {
      result.current.setFetcherState("loading");
    });

    act(() => {
      result.current.setFetcherData({ ok: true });
      result.current.setFetcherState("idle");
    });

    await waitFor(() => {
      expect(result.current.queue).toEqual([queueOp]);
      expect(result.current.isSyncing).toBe(true);
    });
  });
});
