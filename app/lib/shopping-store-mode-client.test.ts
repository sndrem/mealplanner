// @vitest-environment jsdom

import { ShoppingItemSource } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyToggleOpsToItems,
  areToggleQueuesEqual,
  buildStoreModeQueueStorageKey,
  computeStoreModeProgress,
  readStoreModeToggleQueue,
  reconcileToggleQueue,
  removeToggleOp,
  upsertToggleOp,
  writeStoreModeToggleQueue,
} from "./shopping-store-mode-client";

const storageKey = buildStoreModeQueueStorageKey({
  activeShoppingDate: "2026-05-16",
  familyId: "family-1",
  mealPlanId: "meal-plan-1",
});

const sampleItem = {
  checked: false,
  collaborationVersion: "2026-05-01T12:00:00.000Z",
  sourceKey: "entry-1:ingredient-1",
  sourceType: ShoppingItemSource.GENERATED,
} as const;

describe("shopping-store-mode-client", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("builds isolated storage keys per shopping context", () => {
    expect(
      buildStoreModeQueueStorageKey({
        activeShoppingDate: "2026-05-16",
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      }),
    ).not.toBe(
      buildStoreModeQueueStorageKey({
        activeShoppingDate: "2026-05-17",
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      }),
    );
  });

  it("upserts toggle ops by sourceKey", () => {
    const queue = upsertToggleOp([], {
      checked: true,
      expectedUpdatedAt: "v1",
      sourceKey: "a",
      sourceType: ShoppingItemSource.GENERATED,
    });

    const updated = upsertToggleOp(queue, {
      checked: false,
      expectedUpdatedAt: "v2",
      sourceKey: "a",
      sourceType: ShoppingItemSource.GENERATED,
    });

    expect(updated).toEqual([
      {
        checked: false,
        expectedUpdatedAt: "v2",
        sourceKey: "a",
        sourceType: ShoppingItemSource.GENERATED,
      },
    ]);
  });

  it("merges queued checked state onto loader items", () => {
    const merged = applyToggleOpsToItems([sampleItem], [
      {
        checked: true,
        expectedUpdatedAt: "",
        sourceKey: sampleItem.sourceKey,
        sourceType: sampleItem.sourceType,
      },
    ]);

    expect(merged[0]?.checked).toBe(true);
  });

  it("computes progress from merged items", () => {
    expect(
      computeStoreModeProgress([
        { checked: true },
        { checked: false },
        { checked: true },
      ]),
    ).toEqual({
      checkedCount: 2,
      totalCount: 3,
    });
  });

  it("removes queue entries that already match loader state", () => {
    expect(
      reconcileToggleQueue({
        loaderItems: [{ ...sampleItem, checked: true }],
        queue: [
          {
            checked: true,
            expectedUpdatedAt: "",
            sourceKey: sampleItem.sourceKey,
            sourceType: sampleItem.sourceType,
          },
        ],
      }),
    ).toEqual([]);
  });

  it("keeps queue entries when loader still disagrees", () => {
    const queue = [
      {
        checked: true,
        expectedUpdatedAt: "",
        sourceKey: sampleItem.sourceKey,
        sourceType: sampleItem.sourceType,
      },
    ];

    expect(
      reconcileToggleQueue({
        loaderItems: [sampleItem],
        queue,
      }),
    ).toEqual(queue);
  });

  it("persists and reads queue entries from localStorage", () => {
    const queue = [
      {
        checked: true,
        expectedUpdatedAt: "v1",
        sourceKey: "a",
        sourceType: ShoppingItemSource.MANUAL,
      },
    ];

    writeStoreModeToggleQueue(storageKey, queue);

    expect(readStoreModeToggleQueue(storageKey)).toEqual(queue);
    expect(removeToggleOp(queue, "a")).toEqual([]);
  });

  it("compares toggle queues by op fields", () => {
    const queue = [
      {
        checked: true,
        expectedUpdatedAt: "v1",
        sourceKey: "a",
        sourceType: ShoppingItemSource.GENERATED,
      },
    ];

    expect(areToggleQueuesEqual(queue, [...queue])).toBe(true);
    expect(
      areToggleQueuesEqual(queue, [
        {
          ...queue[0]!,
          checked: false,
        },
      ]),
    ).toBe(false);
  });

  it("returns an empty queue for corrupt storage payloads", () => {
    window.localStorage.setItem(storageKey, "{not-an-array");

    expect(readStoreModeToggleQueue(storageKey)).toEqual([]);
  });
});
