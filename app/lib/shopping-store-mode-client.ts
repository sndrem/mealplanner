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

function readStoredFlag(storageKey: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (raw === "true") {
      return true;
    }

    if (raw === "false") {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function writeStoredFlag(storageKey: string, enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, enabled ? "true" : "false");
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}

export function readStoreModeDeprioritizeBought(storageKey: string): boolean {
  return readStoredFlag(storageKey, true);
}

export function writeStoreModeDeprioritizeBought(
  storageKey: string,
  enabled: boolean,
) {
  writeStoredFlag(storageKey, enabled);
}

export function buildStoreModeRecipeUrgencyStorageKey({
  familyId,
}: {
  familyId: string;
}) {
  return `${STORE_MODE_RECIPE_URGENCY_KEY_PREFIX}:${familyId}`;
}

export function readStoreModeRecipeUrgency(storageKey: string): boolean {
  return readStoredFlag(storageKey, false);
}

export function writeStoreModeRecipeUrgency(
  storageKey: string,
  enabled: boolean,
) {
  writeStoredFlag(storageKey, enabled);
}

export function buildStoreModeSinkFinishedSectionsStorageKey({
  familyId,
}: {
  familyId: string;
}) {
  return `${STORE_MODE_SINK_FINISHED_SECTIONS_KEY_PREFIX}:${familyId}`;
}

const SINK_FINISHED_SECTIONS_COOKIE = "mealplanner-sink-finished-sections";

export function readStoreModeSinkFinishedSections(storageKey: string): boolean {
  return readStoredFlag(storageKey, false);
}

export function writeStoreModeSinkFinishedSections(
  storageKey: string,
  enabled: boolean,
) {
  writeStoredFlag(storageKey, enabled);
}

export function readSinkFinishedSectionsCookie(
  cookieHeader: string | null,
  familyId: string,
) {
  const raw = readCookiePair(cookieHeader, SINK_FINISHED_SECTIONS_COOKIE);

  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return false;
    }

    return (parsed as Record<string, unknown>)[familyId] === true;
  } catch {
    return false;
  }
}

export function writeSinkFinishedSectionsCookie(
  familyId: string,
  enabled: boolean,
) {
  if (typeof document === "undefined") {
    return;
  }

  try {
    document.cookie = serializeSinkFinishedSectionsCookie(
      document.cookie,
      familyId,
      enabled,
    );
  } catch {
    // Private mode can block cookies — in-session state still works.
  }
}

export function serializeSinkFinishedSectionsCookie(
  cookieHeader: string | null,
  familyId: string,
  enabled: boolean,
) {
  const choices = readSinkFinishedSectionsCookieMap(cookieHeader);

  if (enabled) {
    choices[familyId] = true;
  } else {
    delete choices[familyId];
  }

  const secure =
    typeof process !== "undefined" && process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  return `${SINK_FINISHED_SECTIONS_COOKIE}=${encodeURIComponent(JSON.stringify(choices))}; Path=/; Max-Age=34560000; SameSite=Lax${secure}`;
}

function readSinkFinishedSectionsCookieMap(cookieHeader: string | null) {
  const raw = readCookiePair(cookieHeader, SINK_FINISHED_SECTIONS_COOKIE);

  if (!raw) {
    return {} as Record<string, true>;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, true>;
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry) => entry[1] === true),
    ) as Record<string, true>;
  } catch {
    return {} as Record<string, true>;
  }
}

function readCookiePair(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    if (trimmed.slice(0, separator) === name) {
      return trimmed.slice(separator + 1);
    }
  }

  return null;
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
  return readStoredFlag(storageKey, false);
}

export function writeStoreModeStockReminderDismissed(
  storageKey: string,
  dismissed: boolean,
) {
  writeStoredFlag(storageKey, dismissed);
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
  const openSections: Array<StoreModePartitionedSection<TSection>> = [];
  const finishedSections: Array<StoreModePartitionedSection<TSection>> = [];

  for (const section of sections) {
    const partitioned = deprioritizeBought
      ? separateBoughtItems(section)
      : {
          ...section,
          boughtItems: [] as TSection["items"],
          items: section.items,
        };

    if (!partitioned) {
      continue;
    }

    if (sinkFinishedSections && sectionHasNothingLeftToBuy(section)) {
      finishedSections.push(partitioned);
    } else {
      openSections.push(partitioned);
    }
  }

  return {
    activeSections: [...openSections, ...finishedSections],
  };
}

function separateBoughtItems<
  TSection extends { items: Array<{ checked: boolean }> },
>(section: TSection): StoreModePartitionedSection<TSection> | null {
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
    return null;
  }

  return {
    ...section,
    boughtItems: checkedItems,
    items: uncheckedItems,
  };
}

function sectionHasNothingLeftToBuy(section: {
  items: Array<{ checked: boolean }>;
}) {
  return section.items.every((item) => item.checked);
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
