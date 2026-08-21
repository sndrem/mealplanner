import { useEffect, useMemo, useState } from "react";
import { isRouteErrorResponse, type MetaFunction } from "react-router";

import { StoreModeShoppingItemCard } from "../components/store-mode-shopping-item-card";
import {
  groupSharedShoppingItemsByStore,
  resolveDefaultSharedStoreId,
  type SharedShoppingSnapshotItem,
} from "../lib/shopping-section-groups";
import {
  buildShoppingShareChecksStorageKey,
  buildShoppingShareStoreStorageKey,
  readShoppingShareCheckedIds,
  readShoppingShareSelectedStoreId,
  writeShoppingShareCheckedIds,
  writeShoppingShareSelectedStoreId,
} from "../lib/shopping-share-client";
import { getShoppingListShareByToken } from "../lib/shopping-share.server";
import {
  partitionStoreModeSections,
  sortStoreModeItemsByName,
} from "../lib/shopping-store-mode-client";
import {
  storeModeAccentBarClass,
  storeModeCountChipClass,
  storeModeHandletFoldClass,
  storeModeMetaStoreSelectClass,
  storeModeMetaStripClass,
  storeModePageClass,
  storeModeProgressDotClass,
  storeModeProgressPillClass,
  storeModeSectionCardClass,
  storeModeSurfaceCardClass,
} from "../lib/store-mode-theme";
import type { Route } from "./+types/shopping-list-share";

export const meta: MetaFunction = () => {
  return [
    { title: "Handleliste | Mealplanner" },
    {
      name: "description",
      content: "Delt handleliste du kan krysse av i butikken.",
    },
  ];
};

export async function loader({ params }: Route.LoaderArgs) {
  const token = requireRouteParam(params.token, "Fant ikke listen.");
  const share = await getShoppingListShareByToken(token);

  if (!share) {
    throw new Response("Fant ikke listen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return {
    snapshot: share.snapshot,
    token,
  };
}

export default function ShoppingListShareRoute({
  loaderData,
}: Route.ComponentProps) {
  const { snapshot, token } = loaderData;
  const checksStorageKey = buildShoppingShareChecksStorageKey(token);
  const storeStorageKey = buildShoppingShareStoreStorageKey(token);
  const defaultStoreId = resolveDefaultSharedStoreId(snapshot.stores);
  const [selectedStoreId, setSelectedStoreId] = useState(defaultStoreId);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const storedStoreId = readShoppingShareSelectedStoreId(storeStorageKey);
    const matchingStore = snapshot.stores.some(
      (store) => store.id === storedStoreId,
    );

    if (storedStoreId && matchingStore) {
      setSelectedStoreId(storedStoreId);
    }

    setCheckedIds(new Set(readShoppingShareCheckedIds(checksStorageKey)));
  }, [checksStorageKey, snapshot.stores, storeStorageKey]);

  const sectionGroups = useMemo(
    () =>
      groupSharedShoppingItemsByStore({
        items: snapshot.items,
        selectedStoreId,
        stores: snapshot.stores,
      }).map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          checked: checkedIds.has(item.id),
        })),
      })),
    [checkedIds, selectedStoreId, snapshot.items, snapshot.stores],
  );
  const { activeSections } = partitionStoreModeSections(sectionGroups, true);
  const checkedCount = checkedIds.size;
  const totalCount = snapshot.items.length;

  function handleToggle(itemId: string) {
    setCheckedIds((current) => {
      const next = new Set(current);

      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }

      writeShoppingShareCheckedIds(checksStorageKey, [...next]);
      return next;
    });
  }

  return (
    <main className={storeModePageClass.replace("pb-36", "pb-8")}>
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <section className={storeModeMetaStripClass}>
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-stone-950">
              Handleliste
            </h1>
            <p className="truncate text-xs text-stone-500">Delt liste</p>
          </div>
          {snapshot.stores.length > 0 ? (
            <>
              <span className="hidden text-stone-300 sm:inline" aria-hidden="true">
                ·
              </span>
              <label className="inline-flex min-w-0 flex-col gap-1">
                <span className="sr-only">Velg butikk</span>
                <select
                  aria-label="Velg butikk"
                  className={storeModeMetaStoreSelectClass}
                  onChange={(event) => {
                    const nextStoreId = event.currentTarget.value;
                    setSelectedStoreId(nextStoreId);
                    writeShoppingShareSelectedStoreId(storeStorageKey, nextStoreId);
                  }}
                  value={selectedStoreId ?? ""}
                >
                  {snapshot.stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <span className={storeModeProgressPillClass}>
            <span aria-hidden="true" className={storeModeProgressDotClass} />
            {checkedCount}/{totalCount}
          </span>
        </section>

        {activeSections.length > 0 ? (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Varer å handle
            </h2>
            {activeSections.map((section) => (
              <details
                key={`${selectedStoreId ?? "no-store"}:${section.category.id}:${section.displayName}`}
                className={storeModeSectionCardClass}
                open
              >
                <div aria-hidden="true" className={storeModeAccentBarClass} />
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-store-accent [&::-webkit-details-marker]:hidden">
                  <span className="text-lg font-semibold tracking-tight text-stone-950">
                    {section.displayName}
                  </span>
                  <span className={storeModeCountChipClass}>
                    {section.items.length > 0
                      ? `${section.items.length} varer`
                      : `${section.boughtItems.length} handlet`}
                  </span>
                </summary>
                {section.items.length > 0 ? (
                  <GuestItemGrid
                    items={section.items}
                    onToggle={handleToggle}
                    selectedStoreId={selectedStoreId ?? undefined}
                  />
                ) : null}
                {section.boughtItems.length > 0 ? (
                  <details
                    className={`${storeModeHandletFoldClass}${section.items.length > 0 ? " mt-4" : " mt-3"}`}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="text-sm font-semibold text-stone-700">
                        Handlet
                      </span>
                      <span className={storeModeCountChipClass}>
                        {section.boughtItems.length} varer
                      </span>
                    </summary>
                    <GuestItemGrid
                      items={section.boughtItems}
                      onToggle={handleToggle}
                      selectedStoreId={selectedStoreId ?? undefined}
                    />
                  </details>
                ) : null}
              </details>
            ))}
          </section>
        ) : (
          <section className={`${storeModeSurfaceCardClass} p-6`}>
            <p className="text-sm leading-6 text-stone-600">
              Denne listen er tom.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi klarte ikke å laste den delte handlelisten.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Fant ikke listen" : title;
    message =
      typeof error.data === "string" && error.data.length > 0
        ? error.data
        : error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <main className={`${storeModePageClass.replace("pb-36", "pb-8")} py-16`}>
      <div className={`mx-auto max-w-2xl ${storeModeSurfaceCardClass} p-8`}>
        <h1 className="text-2xl font-semibold text-stone-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{message}</p>
      </div>
    </main>
  );
}

function GuestItemGrid({
  items,
  onToggle,
  selectedStoreId,
}: {
  items: Array<SharedShoppingSnapshotItem & { checked: boolean }>;
  onToggle: (itemId: string) => void;
  selectedStoreId: string | undefined;
}) {
  const sortedItems = sortStoreModeItemsByName(
    items.map((item) => ({ ...item, sourceKey: item.id })),
  );

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0">
      {sortedItems.map((item) => (
        <StoreModeShoppingItemCard
          key={item.id}
          item={{
            category: {
              id: item.categoryId,
              name: item.categoryName,
            },
            checked: item.checked,
            collaborationVersion: "",
            name: item.name,
            note: item.note,
            preferredStore: null,
            quantity: item.quantityLabel,
            quantityLabel: item.quantityLabel,
            sourceKey: item.id,
            sourceType: "FAMILY",
          }}
          layout="grid"
          onToggle={() => onToggle(item.id)}
          readOnly
          selectedStoreId={selectedStoreId}
        />
      ))}
    </div>
  );
}

function requireRouteParam(value: string | undefined, message: string) {
  if (!value) {
    throw new Response(message, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return value;
}
