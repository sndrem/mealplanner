import { useDrag, useDrop } from "react-dnd";
import { useEffect, useMemo, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import type {
  FamilyStoreFieldErrors,
  FamilyStoreValues,
} from "../lib/store-write.server";

const STORE_SECTION_ITEM_TYPE = "family-store-section";

interface FamilyStoreSection {
  categoryId: string;
  displayName: string;
  id: string;
}

interface FamilyStoreEditorCardProps {
  canManageStores: boolean;
  store: {
    id: string;
    name: string;
    sections: FamilyStoreSection[];
  };
  updateFieldErrors?: FamilyStoreFieldErrors;
  updateValues?: FamilyStoreValues;
}

interface DragItem {
  index: number;
  type: typeof STORE_SECTION_ITEM_TYPE;
}

export function FamilyStoreEditorCard({
  canManageStores,
  store,
  updateFieldErrors,
  updateValues,
}: FamilyStoreEditorCardProps) {
  const navigation = useNavigation();
  const pendingIntent = navigation.formData?.get("intent");
  const pendingStoreId = String(navigation.formData?.get("storeId") ?? "");
  const isUpdatingStore =
    navigation.state !== "idle" &&
    pendingIntent === "update-store" &&
    pendingStoreId === store.id;
  const isDeletingStore =
    navigation.state !== "idle" &&
    pendingIntent === "delete-store" &&
    pendingStoreId === store.id;
  const persistedValues = useMemo<FamilyStoreValues>(
    () => ({
      name: store.name,
      sections: store.sections.map((section) => ({
        categoryId: section.categoryId,
        displayName: section.displayName,
      })),
    }),
    [store.name, store.sections],
  );
  const [ignoreSubmittedValues, setIgnoreSubmittedValues] = useState(false);
  const sourceValues =
    updateValues && !ignoreSubmittedValues ? updateValues : persistedValues;
  const sourceName = sourceValues.name;
  const sourceSections = sourceValues.sections;
  const [draftName, setDraftName] = useState(sourceName);
  const [draftSections, setDraftSections] = useState<FamilyStoreSection[]>(
    toDraftSections(store.sections, sourceSections),
  );
  const [isEditing, setIsEditing] = useState(Boolean(updateValues));

  useEffect(() => {
    if (updateValues) {
      setIgnoreSubmittedValues(false);
    }
  }, [updateValues]);

  useEffect(() => {
    setDraftName(sourceName);
    setDraftSections(toDraftSections(store.sections, sourceSections));
    setIsEditing(Boolean(updateValues && !ignoreSubmittedValues));
  }, [
    ignoreSubmittedValues,
    sourceName,
    sourceSections,
    store.sections,
    updateValues,
  ]);

  function handleSectionDisplayNameChange(
    categoryId: string,
    displayName: string,
  ) {
    setDraftSections((current) =>
      current.map((section) =>
        section.categoryId === categoryId
          ? {
              ...section,
              displayName,
            }
          : section,
      ),
    );
  }

  function moveSection(fromIndex: number, toIndex: number) {
    setDraftSections((current) => {
      const next = [...current];
      const [movedSection] = next.splice(fromIndex, 1);

      if (!movedSection) {
        return current;
      }

      next.splice(toIndex, 0, movedSection);
      return next;
    });
  }

  function handleStartEditing() {
    setIgnoreSubmittedValues(false);
    setDraftName(persistedValues.name);
    setDraftSections(toDraftSections(store.sections, persistedValues.sections));
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setIgnoreSubmittedValues(true);
    setDraftName(persistedValues.name);
    setDraftSections(toDraftSections(store.sections, persistedValues.sections));
    setIsEditing(false);
  }

  return (
    <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            {isUpdatingStore ? draftName : store.name}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isEditing
              ? "Dra og slipp seksjonene i den rekkefølgen dere faktisk går gjennom butikken, og lagre når alt ser riktig ut."
              : "Åpne redigering for å endre navn, seksjonsnavn og rekkefølge i en samlet lagring."}
          </p>
        </div>

        {canManageStores && !isEditing && !store.id.startsWith("optimistic:") ? (
          <button
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={handleStartEditing}
            type="button"
          >
            Rediger
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <Form className="mt-6 space-y-4" method="post">
          <input name="intent" type="hidden" value="update-store" />
          <input name="storeId" type="hidden" value={store.id} />

          <label className="block text-sm font-medium text-slate-700">
            Butikknavn
            <input
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              name="name"
              onChange={(event) => setDraftName(event.target.value)}
              type="text"
              value={draftName}
            />
          </label>
          {updateFieldErrors?.name ? (
            <p className="text-sm text-rose-600">{updateFieldErrors.name}</p>
          ) : null}

          <div className="space-y-3">
            {draftSections.map((section, index) => (
              <StoreSectionEditorRow
                index={index}
                isEditing={isEditing}
                key={`${store.id}:${section.categoryId}`}
                onDisplayNameChange={handleSectionDisplayNameChange}
                onMove={moveSection}
                section={section}
                validationError={
                  updateFieldErrors?.sectionDisplayNames?.[section.categoryId]
                }
              />
            ))}
          </div>

          {updateFieldErrors?.sections ? (
            <p className="text-sm text-rose-600">
              {updateFieldErrors.sections}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isUpdatingStore}
              type="submit"
            >
              {isUpdatingStore ? "Lagrer..." : "Lagre endringer"}
            </button>
            <button
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
              onClick={handleCancelEditing}
              type="button"
            >
              Avbryt
            </button>
          </div>
        </Form>
      ) : (
        <div className="mt-6 grid gap-3">
          {store.sections.map((section, index) => (
            <div
              className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-white px-4 py-3"
              key={`${store.id}:${section.id}:summary`}
            >
              <div>
                <p className="text-sm text-slate-500">Plass {index + 1}</p>
                <p className="font-medium text-slate-900">
                  {section.displayName}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {canManageStores && !isEditing && !store.id.startsWith("optimistic:") ? (
        <div className="mt-4">
          <Form method="post">
            <input name="intent" type="hidden" value="delete-store" />
            <input name="storeId" type="hidden" value={store.id} />
            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
              disabled={isDeletingStore}
              type="submit"
            >
              {isDeletingStore ? "Sletter..." : "Slett butikk"}
            </button>
          </Form>
        </div>
      ) : null}
    </article>
  );
}

function StoreSectionEditorRow({
  index,
  isEditing,
  onDisplayNameChange,
  onMove,
  section,
  validationError,
}: {
  index: number;
  isEditing: boolean;
  onDisplayNameChange: (categoryId: string, displayName: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  section: FamilyStoreSection;
  validationError?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [{ isDragging }, drag] = useDrag(
    () => ({
      canDrag: isEditing,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      item: {
        index,
        type: STORE_SECTION_ITEM_TYPE,
      } satisfies DragItem,
      type: STORE_SECTION_ITEM_TYPE,
    }),
    [index, isEditing],
  );
  const [, drop] = useDrop<DragItem>(
    () => ({
      accept: STORE_SECTION_ITEM_TYPE,
      hover: (dragItem, monitor) => {
        if (!ref.current) {
          return;
        }

        const dragIndex = dragItem.index;
        const hoverIndex = index;

        if (dragIndex === hoverIndex) {
          return;
        }

        const hoverBoundingRect = ref.current.getBoundingClientRect();
        const hoverMiddleY =
          (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        const clientOffset = monitor.getClientOffset();

        if (!clientOffset) {
          return;
        }

        const hoverClientY = clientOffset.y - hoverBoundingRect.top;

        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
          return;
        }

        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
          return;
        }

        onMove(dragIndex, hoverIndex);
        dragItem.index = hoverIndex;
      },
    }),
    [index, onMove],
  );

  drag(drop(ref));

  return (
    <div
      className={
        isDragging
          ? "rounded-[20px] border border-emerald-300 bg-emerald-50 p-4 opacity-60"
          : "rounded-[20px] border border-slate-200 bg-white p-4"
      }
      ref={ref}
    >
      <input
        name="sectionCategoryId"
        type="hidden"
        value={section.categoryId}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
            {index + 1}
          </div>
          <div
            className={
              isEditing
                ? "cursor-grab rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em]"
                : "rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em]"
            }
          >
            Dra
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <input
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            name={`sectionDisplayName:${section.categoryId}`}
            onChange={(event) =>
              onDisplayNameChange(section.categoryId, event.target.value)
            }
            type="text"
            value={section.displayName}
          />
          {validationError ? (
            <p className="mt-2 text-sm text-rose-600">{validationError}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function toDraftSections(
  persistedSections: FamilyStoreSection[],
  valueSections: FamilyStoreValues["sections"],
) {
  const persistedSectionIds = new Map(
    persistedSections.map((section) => [section.categoryId, section.id]),
  );

  return valueSections.map((section) => ({
    categoryId: section.categoryId,
    displayName: section.displayName,
    id: persistedSectionIds.get(section.categoryId) ?? section.categoryId,
  }));
}
