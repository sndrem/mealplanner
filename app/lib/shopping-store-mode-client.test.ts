// @vitest-environment jsdom

import { ShoppingItemSource } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyToggleOpsToItems,
  areToggleQueuesEqual,
  buildStoreModeDeprioritizeBoughtStorageKey,
  buildStoreModeQueueStorageKey,
  buildStoreModeViewStorageKey,
  computeStoreModeProgress,
  getToggleExpectedVersion,
  partitionStoreModeSections,
  readStoreModeDeprioritizeBought,
  readStoreModeShoppingView,
  readStoreModeToggleQueue,
  reconcileToggleQueue,
  removeToggleOp,
  upsertToggleOp,
  writeStoreModeDeprioritizeBought,
  writeStoreModeShoppingView,
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

  it("accepts FAMILY toggle operations and uses collaboration version", () => {
    expect(
      getToggleExpectedVersion({
        collaborationVersion: "family-v1",
        sourceType: "FAMILY",
      }),
    ).toBe("family-v1");

    writeStoreModeToggleQueue(storageKey, [
      {
        checked: true,
        expectedUpdatedAt: "family-v1",
        sourceKey: "family-item-1",
        sourceType: "FAMILY",
      },
    ]);

    expect(readStoreModeToggleQueue(storageKey)).toEqual([
      {
        checked: true,
        expectedUpdatedAt: "family-v1",
        sourceKey: "family-item-1",
        sourceType: "FAMILY",
      },
    ]);
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

  it("builds isolated view storage keys per meal plan", () => {
    expect(
      buildStoreModeViewStorageKey({
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      }),
    ).not.toBe(
      buildStoreModeViewStorageKey({
        familyId: "family-1",
        mealPlanId: "meal-plan-2",
      }),
    );
  });

  it("defaults shopping view to list", () => {
    const viewStorageKey = buildStoreModeViewStorageKey({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
    });

    expect(readStoreModeShoppingView(viewStorageKey)).toBe("list");
  });

  it("persists and reads shopping view preference", () => {
    const viewStorageKey = buildStoreModeViewStorageKey({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
    });

    writeStoreModeShoppingView(viewStorageKey, "grid");

    expect(readStoreModeShoppingView(viewStorageKey)).toBe("grid");
  });

  it("falls back to list for invalid stored shopping views", () => {
    const viewStorageKey = buildStoreModeViewStorageKey({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
    });

    window.localStorage.setItem(viewStorageKey, "table");

    expect(readStoreModeShoppingView(viewStorageKey)).toBe("list");
  });

  it("builds isolated deprioritize-bought storage keys per meal plan", () => {
    expect(
      buildStoreModeDeprioritizeBoughtStorageKey({
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      }),
    ).not.toBe(
      buildStoreModeDeprioritizeBoughtStorageKey({
        familyId: "family-1",
        mealPlanId: "meal-plan-2",
      }),
    );
  });

  it("defaults deprioritize-bought preference to false", () => {
    const storageKey = buildStoreModeDeprioritizeBoughtStorageKey({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
    });

    expect(readStoreModeDeprioritizeBought(storageKey)).toBe(false);
  });

  it("persists and reads deprioritize-bought preference", () => {
    const storageKey = buildStoreModeDeprioritizeBoughtStorageKey({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
    });

    writeStoreModeDeprioritizeBought(storageKey, true);

    expect(readStoreModeDeprioritizeBought(storageKey)).toBe(true);
  });

  it("falls back to false for invalid stored deprioritize-bought values", () => {
    const storageKey = buildStoreModeDeprioritizeBoughtStorageKey({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
    });

    window.localStorage.setItem(storageKey, "yes");

    expect(readStoreModeDeprioritizeBought(storageKey)).toBe(false);
  });

  it("returns sections unchanged when deprioritize-bought is off", () => {
    const sections = [
      {
        displayName: "Produce",
        items: [
          { checked: true, id: "a" },
          { checked: false, id: "b" },
        ],
      },
    ];

    expect(partitionStoreModeSections(sections, false)).toEqual({
      activeSections: sections,
      boughtItems: [],
    });
  });

  it("partitions unchecked into active sections and checked into bought items", () => {
    const sections = [
      {
        displayName: "Produce",
        items: [
          { checked: true, id: "a" },
          { checked: false, id: "b" },
        ],
      },
      {
        displayName: "Dairy",
        items: [{ checked: true, id: "c" }],
      },
    ];

    expect(partitionStoreModeSections(sections, true)).toEqual({
      activeSections: [
        {
          displayName: "Produce",
          items: [{ checked: false, id: "b" }],
        },
      ],
      boughtItems: [
        { checked: true, id: "a" },
        { checked: true, id: "c" },
      ],
    });
  });
});
