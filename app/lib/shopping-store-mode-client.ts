import { ShoppingItemSource } from "@prisma/client";

import type { ShoppingGroceryGroupingMember } from "./shopping-grocery-grouping";

export type StoreModeItemSource = ShoppingItemSource | "FAMILY";

export interface StoreModeToggleOp {
  checked: boolean;
  expectedUpdatedAt: string;
  mealPlanId?: string | null;
  sourceKey: string;
  sourceType: StoreModeItemSource;
}

export interface StoreModeToggleItem {
  checked: boolean;
  collaborationVersion: string;
  groupingMembers?: ShoppingGroceryGroupingMember[];
  mealPlanId?: string | null;
  overrideVersion?: string;
  sourceKey: string;
  sourceType: StoreModeItemSource;
}

export interface StoreModeProgress {
  checkedCount: number;
  totalCount: number;
}

export interface StoreModeScanProgress {
  percent: number;
  remainingCount: number;
}

export type StoreModeTripFocusScanValue = "ALL" | "CURRENT" | "NEXT";

const storeModeTripFocusScanLabels: Record<StoreModeTripFocusScanValue, string> =
  {
    ALL: "Alle åpne",
    CURRENT: "Denne uken",
    NEXT: "Neste uke",
  };

export type StoreModeShoppingView = "list" | "grid";

const DEFAULT_STORE_MODE_SHOPPING_VIEW: StoreModeShoppingView = "grid";

const STORE_MODE_QUEUE_KEY_PREFIX = "mealplanner:store-mode-queue:v1";
const STORE_MODE_VIEW_KEY_PREFIX = "mealplanner:store-mode-view:v1";
const STORE_MODE_DEPRIORITIZE_BOUGHT_KEY_PREFIX =
  "mealplanner:store-mode-deprioritize-bought:v1";
const STORE_MODE_RECIPE_URGENCY_KEY_PREFIX =
  "mealplanner:store-mode-recipe-urgency:v1";
const STORE_MODE_SINK_FINISHED_SECTIONS_KEY_PREFIX =
  "mealplanner:store-mode-sink-finished-sections:v1";
const STORE_MODE_STOCK_REMINDER_DISMISSED_KEY_PREFIX =
  "mealplanner:store-mode-stock-reminder-dismissed:v1";
const STORE_OFFER_BRIEFING_SEEN_KEY_PREFIX =
  "mealplanner:store-offer-briefing-seen:v1";
const STORE_OFFER_BRIEFING_DISMISSED_KEY_PREFIX =
  "mealplanner:store-offer-briefing-dismissed:v1";

export function buildStoreModeViewStorageKey({
  familyId,
}: {
  familyId: string;
}) {
  return `${STORE_MODE_VIEW_KEY_PREFIX}:${familyId}`;
}

export function readStoreModeShoppingView(
  storageKey: string,
): StoreModeShoppingView {
  if (typeof window === "undefined") {
    return DEFAULT_STORE_MODE_SHOPPING_VIEW;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (raw === "grid" || raw === "list") {
      return raw;
    }

    return DEFAULT_STORE_MODE_SHOPPING_VIEW;
  } catch {
    return DEFAULT_STORE_MODE_SHOPPING_VIEW;
  }
}

export function writeStoreModeShoppingView(
  storageKey: string,
  view: StoreModeShoppingView,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, view);
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}

export function buildStoreModeDeprioritizeBoughtStorageKey({
  familyId,
}: {
  familyId: string;
}) {
  return `${STORE_MODE_DEPRIORITIZE_BOUGHT_KEY_PREFIX}:${familyId}`;
}

export function readStoreModeDeprioritizeBought(storageKey: string): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (raw === "false") {
      return false;
    }

    if (raw === "true") {
      return true;
    }

    return true;
  } catch {
    return true;
  }
}

export function writeStoreModeDeprioritizeBought(
  storageKey: string,
  enabled: boolean,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, enabled ? "true" : "false");
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}

export function buildStoreModeRecipeUrgencyStorageKey({
  familyId,
}: {
  familyId: string;
}) {
  return `${STORE_MODE_RECIPE_URGENCY_KEY_PREFIX}:${familyId}`;
}

export function readStoreModeRecipeUrgency(storageKey: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

export function writeStoreModeRecipeUrgency(
  storageKey: string,
  enabled: boolean,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, enabled ? "true" : "false");
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}

export function buildStoreModeSinkFinishedSectionsStorageKey({
  familyId,
}: {
  familyId: string;
}) {
  return `${STORE_MODE_SINK_FINISHED_SECTIONS_KEY_PREFIX}:${familyId}`;
}

export function readStoreModeSinkFinishedSections(storageKey: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

export function writeStoreModeSinkFinishedSections(
  storageKey: string,
  enabled: boolean,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, enabled ? "true" : "false");
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}

export function buildStoreModeStockReminderDismissedStorageKey({
  familyId,
  mealPlanId,
}: {
  familyId: string;
  mealPlanId: string;
}) {
  return `${STORE_MODE_STOCK_REMINDER_DISMISSED_KEY_PREFIX}:${familyId}:${mealPlanId}`;
}

export function buildStoreOfferBriefingSeenStorageKey({
  briefingId,
  familyId,
  updatedAt,
}: {
  briefingId: string;
  familyId: string;
  updatedAt: string;
}) {
  return `${STORE_OFFER_BRIEFING_SEEN_KEY_PREFIX}:${familyId}:${briefingId}:${updatedAt}`;
}

export function buildStoreOfferBriefingDismissedStorageKey({
  briefingId,
  familyId,
  updatedAt,
}: {
  briefingId: string;
  familyId: string;
  updatedAt: string;
}) {
  return `${STORE_OFFER_BRIEFING_DISMISSED_KEY_PREFIX}:${familyId}:${briefingId}:${updatedAt}`;
}

export function readStoreModeStockReminderDismissed(storageKey: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

export function writeStoreModeStockReminderDismissed(
  storageKey: string,
  dismissed: boolean,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, dismissed ? "true" : "false");
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}

function compareStoreModeItemsByName(
  left: { name: string; sourceKey: string },
  right: { name: string; sourceKey: string },
) {
  const nameComparison = left.name.localeCompare(right.name, "nb");

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.sourceKey.localeCompare(right.sourceKey, "nb");
}

export function sortStoreModeItemsByName<
  TItem extends { name: string; sourceKey: string },
>(items: TItem[]): TItem[] {
  return [...items].sort(compareStoreModeItemsByName);
}

export type StoreModePartitionedSection<
  TSection extends { items: Array<{ checked: boolean }> },
> = Omit<TSection, "items"> & {
  boughtItems: TSection["items"];
  items: TSection["items"];
};

export function partitionStoreModeSections<
  TSection extends { items: Array<{ checked: boolean }> },
>(
  sections: TSection[],
  deprioritizeBought: boolean,
  sinkFinishedSections = false,
): { activeSections: Array<StoreModePartitionedSection<TSection>> } {
  const activeSections = deprioritizeBought
    ? partitionFoldedStoreModeSections(sections)
    : sections.map((section) => ({
        ...section,
        boughtItems: [] as TSection["items"],
        items: section.items,
      }));

  if (!sinkFinishedSections) {
    return { activeSections };
  }

  return {
    activeSections: sinkFinishedStoreModeSections(
      activeSections,
      deprioritizeBought,
    ),
  };
}

function partitionFoldedStoreModeSections<
  TSection extends { items: Array<{ checked: boolean }> },
>(sections: TSection[]) {
  const activeSections: Array<StoreModePartitionedSection<TSection>> = [];

  for (const section of sections) {
    const uncheckedItems = [] as TSection["items"];
    const checkedItems = [] as TSection["items"];

    for (const item of section.items) {
      if (item.checked) {
        checkedItems.push(item);
      } else {
        uncheckedItems.push(item);
      }
    }

    if (uncheckedItems.length === 0 && checkedItems.length === 0) {
      continue;
    }

    activeSections.push({
      ...section,
      boughtItems: checkedItems,
      items: uncheckedItems,
    });
  }

  return activeSections;
}

function sinkFinishedStoreModeSections<
  TSection extends { items: Array<{ checked: boolean }> },
>(
  sections: Array<StoreModePartitionedSection<TSection>>,
  deprioritizeBought: boolean,
) {
  const openSections: Array<StoreModePartitionedSection<TSection>> = [];
  const finishedSections: Array<StoreModePartitionedSection<TSection>> = [];

  for (const section of sections) {
    if (isFinishedStoreModeSection(section, deprioritizeBought)) {
      finishedSections.push(section);
    } else {
      openSections.push(section);
    }
  }

  return [...openSections, ...finishedSections];
}

function isFinishedStoreModeSection(
  section: { boughtItems: Array<{ checked: boolean }>; items: Array<{ checked: boolean }> },
  deprioritizeBought: boolean,
) {
  if (deprioritizeBought) {
    return section.items.length === 0 && section.boughtItems.length > 0;
  }

  return (
    section.items.length > 0 && section.items.every((item) => item.checked)
  );
}

export function splitShoppingItemsByChecked<TItem extends { checked: boolean }>(
  items: TItem[],
) {
  const openItems: TItem[] = [];
  const boughtItems: TItem[] = [];

  for (const item of items) {
    if (item.checked) {
      boughtItems.push(item);
    } else {
      openItems.push(item);
    }
  }

  return {
    boughtItems,
    openItems,
  };
}

export function flattenStoreModeSectionsForHiddenHeadings<
  TItem extends { checked: boolean; name: string; sourceKey: string },
>(sections: Array<{ boughtItems: TItem[]; items: TItem[] }>) {
  const openItems: TItem[] = [];
  const boughtItems: TItem[] = [];

  for (const section of sections) {
    const sectionOpenItems: TItem[] = [];
    const sectionBoughtItems: TItem[] = [];

    for (const item of section.items) {
      if (item.checked) {
        sectionBoughtItems.push(item);
      } else {
        sectionOpenItems.push(item);
      }
    }

    openItems.push(...sortStoreModeItemsByName(sectionOpenItems));
    boughtItems.push(
      ...sortStoreModeItemsByName([
        ...sectionBoughtItems,
        ...section.boughtItems,
      ]),
    );
  }

  return {
    boughtItems,
    openItems,
  };
}

export function buildStoreModeQueueStorageKey({
  activeShoppingDate,
  familyId,
}: {
  activeShoppingDate: string;
  familyId: string;
}) {
  return `${STORE_MODE_QUEUE_KEY_PREFIX}:${familyId}:${activeShoppingDate}`;
}

export function readStoreModeToggleQueue(storageKey: string): StoreModeToggleOp[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStoreModeToggleOp);
  } catch {
    return [];
  }
}

export function writeStoreModeToggleQueue(
  storageKey: string,
  queue: StoreModeToggleOp[],
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(queue));
  } catch {
    // Private mode or quota exceeded — in-session optimistic state still works.
  }
}

export function upsertToggleOp(
  queue: StoreModeToggleOp[],
  op: StoreModeToggleOp,
): StoreModeToggleOp[] {
  const withoutExisting = queue.filter((entry) => entry.sourceKey !== op.sourceKey);
  return [...withoutExisting, op];
}

export function removeToggleOp(queue: StoreModeToggleOp[], sourceKey: string) {
  return queue.filter((entry) => entry.sourceKey !== sourceKey);
}

export function applyToggleOpsToItems<T extends StoreModeToggleItem>(
  items: T[],
  ops: StoreModeToggleOp[],
): T[] {
  if (ops.length === 0) {
    return items;
  }

  const opBySourceKey = new Map(ops.map((op) => [op.sourceKey, op]));

  return items.map((item) => {
    if (item.groupingMembers && item.groupingMembers.length > 1) {
      const groupingMembers = item.groupingMembers.map((member) => {
        const op = opBySourceKey.get(member.sourceKey);

        if (!op) {
          return member;
        }

        return {
          ...member,
          checked: op.checked,
        };
      });

      return {
        ...item,
        checked: groupingMembers.every((member) => member.checked),
        groupingMembers,
      };
    }

    const op = opBySourceKey.get(item.sourceKey);

    if (!op) {
      return item;
    }

    return {
      ...item,
      checked: op.checked,
    };
  });
}

export function computeStoreModeProgress(
  items: Pick<StoreModeToggleItem, "checked">[],
): StoreModeProgress {
  return {
    checkedCount: items.filter((item) => item.checked).length,
    totalCount: items.length,
  };
}

export function computeStoreModeScanProgress(
  progress: StoreModeProgress,
): StoreModeScanProgress {
  const remainingCount = Math.max(
    0,
    progress.totalCount - progress.checkedCount,
  );
  const percent =
    progress.totalCount === 0
      ? 0
      : Math.min(
          100,
          Math.max(0, (progress.checkedCount / progress.totalCount) * 100),
        );

  return {
    percent,
    remainingCount,
  };
}

export function isStoreModeTripFocusScanValue(
  value: unknown,
): value is StoreModeTripFocusScanValue {
  return value === "ALL" || value === "CURRENT" || value === "NEXT";
}

export function getStoreModeTripFocusScanLabel(
  focus: StoreModeTripFocusScanValue,
) {
  return storeModeTripFocusScanLabels[focus];
}

export function areToggleQueuesEqual(
  left: StoreModeToggleOp[],
  right: StoreModeToggleOp[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((op, index) => {
    const other = right[index];

    return (
      op.sourceKey === other.sourceKey &&
      op.sourceType === other.sourceType &&
      op.checked === other.checked &&
      op.expectedUpdatedAt === other.expectedUpdatedAt &&
      (op.mealPlanId ?? null) === (other.mealPlanId ?? null)
    );
  });
}

export function reconcileToggleQueue({
  loaderItems,
  queue,
}: {
  loaderItems: StoreModeToggleItem[];
  queue: StoreModeToggleOp[];
}): StoreModeToggleOp[] {
  if (queue.length === 0) {
    return queue;
  }

  const loaderBySourceKey = new Map(
    flattenStoreModeToggleItems(loaderItems).map((item) => [item.sourceKey, item]),
  );

  return queue.filter((op) => {
    const loaderItem = loaderBySourceKey.get(op.sourceKey);

    if (!loaderItem) {
      // Family items leave the store-mode loader once checked (only unchecked
      // items are loaded). Drop fulfilled check ops; keep uncheck ops pending.
      return !op.checked;
    }

    return loaderItem.checked !== op.checked;
  });
}

function flattenStoreModeToggleItems(
  items: StoreModeToggleItem[],
): StoreModeToggleItem[] {
  return items.flatMap((item) => {
    if (!item.groupingMembers || item.groupingMembers.length < 2) {
      return [item];
    }

    return item.groupingMembers.map((member) => ({
      checked: member.checked,
      collaborationVersion: member.collaborationVersion,
      mealPlanId: member.mealPlanId,
      sourceKey: member.sourceKey,
      sourceType: item.sourceType,
    }));
  });
}

export function getToggleExpectedVersion(item: {
  collaborationVersion: string;
  overrideVersion?: string;
  sourceType: StoreModeItemSource;
}) {
  if (item.sourceType === ShoppingItemSource.MANUAL) {
    return item.overrideVersion ?? "";
  }

  return item.collaborationVersion;
}

function isStoreModeToggleOp(value: unknown): value is StoreModeToggleOp {
  if (!value || typeof value !== "object") {
    return false;
  }

  const op = value as Partial<StoreModeToggleOp>;

  return (
    typeof op.sourceKey === "string" &&
    op.sourceKey.length > 0 &&
    (op.sourceType === ShoppingItemSource.GENERATED ||
      op.sourceType === ShoppingItemSource.MANUAL ||
      op.sourceType === "FAMILY") &&
    typeof op.checked === "boolean" &&
    typeof op.expectedUpdatedAt === "string"
  );
}
