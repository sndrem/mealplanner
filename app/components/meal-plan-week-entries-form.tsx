import { useEffect, useRef, useState, type ReactNode } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import { Form, Link } from "react-router";

import { formatDateOnly, isPlanDateToday } from "../lib/meal-plan-dates";
import {
  encodeMealSelection,
  formatMealPlanRecipeSelectLabel,
  formatShortDateLabel,
  getDinnerMenuLabel,
  parseMealSelection,
  swapOrMoveMealSelection,
} from "../lib/meal-plan-display";

const MEAL_PLAN_DAY_MEAL = "meal-plan-day-meal";

interface MealPlanFamilyMemberOption {
  displayName: string;
  id: string;
}

export interface MealPlanEntryFormState {
  freezerItemId: string;
  note: string;
  recipeId: string;
  responsibleUserId: string;
  updatedAt: string;
}

interface MealPlanRecipeOption {
  defaultServings: number | null;
  description: string | null;
  id: string;
  prepMinutes: number | null;
  tags: string[];
  title: string;
}

interface MealPlanFreezerOption {
  id: string;
  label: string;
  note: string | null;
  quantity: number;
}

interface MealDayDragItem {
  date: string;
  type: typeof MEAL_PLAN_DAY_MEAL;
}

function buildMealSelectionsByDate(
  visibleDates: string[],
  entryValues: Record<string, MealPlanEntryFormState>,
) {
  return Object.fromEntries(
    visibleDates.map((date) => {
      const entry = entryValues[date];

      return [
        date,
        encodeMealSelection({
          freezerItemId: entry?.freezerItemId ?? "",
          recipeId: entry?.recipeId ?? "",
        }),
      ];
    }),
  );
}

function MealPlanDndProvider({ children }: { children: ReactNode }) {
  const [backendKey, setBackendKey] = useState<"html5" | "touch">("html5");

  useEffect(() => {
    const hasTouchPoints = navigator.maxTouchPoints > 0;
    const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

    if (hasTouchPoints || hasCoarsePointer) {
      setBackendKey("touch");
    }
  }, []);

  return (
    <DndProvider
      backend={backendKey === "touch" ? TouchBackend : HTML5Backend}
      key={backendKey}
      options={
        backendKey === "touch"
          ? {
              delayTouchStart: 140,
              enableMouseEvents: true,
              ignoreContextMenu: true,
              touchSlop: 12,
            }
          : undefined
      }
    >
      {children}
    </DndProvider>
  );
}

export function MealPlanWeekEntriesForm({
  calendarDownloadTarget,
  calendarExportDateSet,
  entryFormError,
  entriesSnapshot,
  entryValues,
  familyId,
  familyMembers,
  freezerItems,
  isAutoFillingEntries,
  isResettingEntries,
  isSavingEntries,
  mealPlanId,
  recipes,
  visibleDates,
}: {
  calendarDownloadTarget: string;
  calendarExportDateSet: Set<string>;
  entryFormError?: string;
  entriesSnapshot: string;
  entryValues: Record<string, MealPlanEntryFormState>;
  familyId: string;
  familyMembers: MealPlanFamilyMemberOption[];
  freezerItems: MealPlanFreezerOption[];
  isAutoFillingEntries: boolean;
  isResettingEntries: boolean;
  isSavingEntries: boolean;
  mealPlanId: string;
  recipes: MealPlanRecipeOption[];
  visibleDates: string[];
}) {
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [mealSelectionsByDate, setMealSelectionsByDate] = useState(() =>
    buildMealSelectionsByDate(visibleDates, entryValues),
  );

  useEffect(() => {
    setMealSelectionsByDate(
      buildMealSelectionsByDate(visibleDates, entryValues),
    );
    setIsReorderMode(false);
    // Only reset when the server snapshot changes. Including entryValues/visibleDates
    // would wipe in-progress drag swaps whenever parent re-renders with new object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: snapshot-gated reset
  }, [entriesSnapshot]);

  useEffect(() => {
    if (isSavingEntries) {
      setIsReorderMode(false);
    }
  }, [isSavingEntries]);

  const applySwapOrMove = (fromDate: string, toDate: string) => {
    setMealSelectionsByDate((current) =>
      swapOrMoveMealSelection(current, fromDate, toDate),
    );
  };

  const dayList = (
    <div className="grid min-w-0 gap-2">
      {visibleDates.map((date, index) => {
        const entry = entryValues[date] ?? {
          freezerItemId: "",
          note: "",
          recipeId: "",
          responsibleUserId: "",
          updatedAt: "",
        };
        const showWeekSeparator =
          visibleDates.length > 7 && (index === 0 || isUtcMonday(date));

        return (
          <div key={date} className="grid min-w-0 gap-2">
            {showWeekSeparator ? (
              <p className="pt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                {formatWeekChunkLabel(date)}
              </p>
            ) : null}
            <MealPlanDayRow
              calendarDownloadTarget={calendarDownloadTarget}
              canExportDay={calendarExportDateSet.has(date)}
              date={date}
              entry={entry}
              familyId={familyId}
              familyMembers={familyMembers}
              freezerItems={freezerItems}
              isReorderMode={isReorderMode}
              isToday={isPlanDateToday(date)}
              mealPlanId={mealPlanId}
              mealSelection={mealSelectionsByDate[date] ?? ""}
              onMealSelectionChange={(value) => {
                setMealSelectionsByDate((current) => ({
                  ...current,
                  [date]: value,
                }));
              }}
              onSwapOrMove={applySwapOrMove}
              recipes={recipes}
              visibleDates={visibleDates}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <Form
      key={entriesSnapshot}
      className="mt-4 min-w-0 space-y-3"
      method="post"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className={
            isReorderMode
              ? "inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 sm:w-auto"
              : "inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 sm:w-auto"
          }
          onClick={() => setIsReorderMode((current) => !current)}
          type="button"
        >
          {isReorderMode ? "Ferdig" : "Omorganiser middager"}
        </button>
      </div>

      {isReorderMode ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
          Dra middager mellom dager, eller bruk Bytt med. Notat og ansvarlig
          blir stående på samme dag.
        </p>
      ) : null}

      {isReorderMode ? (
        <MealPlanDndProvider>{dayList}</MealPlanDndProvider>
      ) : (
        dayList
      )}

      {entryFormError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {entryFormError}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={
            isSavingEntries || isResettingEntries || isAutoFillingEntries
          }
          name="intent"
          type="submit"
          value="save-meal-plan-entries"
        >
          {isSavingEntries ? "Lagrer middager..." : "Lagre middager"}
        </button>
        <button
          className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          disabled={
            isSavingEntries || isResettingEntries || isAutoFillingEntries
          }
          name="intent"
          type="submit"
          value="reset-meal-plan-entries"
        >
          {isResettingEntries ? "Tilbakestiller..." : "Tilbakestill ukeoversikt"}
        </button>
      </div>
    </Form>
  );
}

function MealPlanDayRow({
  calendarDownloadTarget,
  canExportDay,
  date,
  entry,
  familyId,
  familyMembers,
  freezerItems,
  isReorderMode,
  isToday,
  mealPlanId,
  mealSelection,
  onMealSelectionChange,
  onSwapOrMove,
  recipes,
  visibleDates,
}: {
  calendarDownloadTarget: string;
  canExportDay: boolean;
  date: string;
  entry: MealPlanEntryFormState;
  familyId: string;
  familyMembers: MealPlanFamilyMemberOption[];
  freezerItems: MealPlanFreezerOption[];
  isReorderMode: boolean;
  isToday: boolean;
  mealPlanId: string;
  mealSelection: string;
  onMealSelectionChange: (value: string) => void;
  onSwapOrMove: (fromDate: string, toDate: string) => void;
  recipes: MealPlanRecipeOption[];
  visibleDates: string[];
}) {
  const [selectedResponsibleUserId, setSelectedResponsibleUserId] = useState(
    entry.responsibleUserId,
  );
  const [byttMedValue, setByttMedValue] = useState("");

  useEffect(() => {
    setSelectedResponsibleUserId(entry.responsibleUserId);
  }, [entry.responsibleUserId]);

  const parsedSelection = parseMealSelection(mealSelection);
  const selectedRecipe =
    recipes.find((recipe) => recipe.id === parsedSelection.recipeId) ?? null;
  const selectedFreezerItem =
    freezerItems.find((item) => item.id === parsedSelection.freezerItemId) ??
    null;
  const mealLabel = getMealDaySummaryLabel(
    entry,
    selectedRecipe,
    selectedFreezerItem,
  );
  const hasMealSelection = Boolean(mealSelection);
  const hasNoteOnly =
    !parsedSelection.recipeId &&
    !parsedSelection.freezerItemId &&
    Boolean(entry.note.trim());
  const hasFreezerSelection = Boolean(parsedSelection.freezerItemId);
  const responsibleMember =
    familyMembers.find(
      (member) => member.id === selectedResponsibleUserId,
    ) ?? null;
  const selectableFreezerItems = freezerItems.filter(
    (item) =>
      item.quantity > 0 || item.id === parsedSelection.freezerItemId,
  );

  const formFields = (
    <>
      <input name="entryDate" type="hidden" value={date} />
      <input
        name={`entryUpdatedAt:${date}`}
        type="hidden"
        value={entry.updatedAt}
      />
      <input name={`mealSelection:${date}`} type="hidden" value={mealSelection} />
      <input
        name={`responsibleUserId:${date}`}
        type="hidden"
        value={selectedResponsibleUserId}
      />
      {/*
        Keep note as a real field when editing; in reorder mode use hidden so
        the uncontrolled textarea value is still submitted from the open editor
        path below when not reordering.
      */}
      {isReorderMode ? (
        <input name={`note:${date}`} type="hidden" value={entry.note} />
      ) : null}
    </>
  );

  if (isReorderMode) {
    return (
      <MealPlanReorderDayRow
        date={date}
        formFields={formFields}
        hasFreezerSelection={hasFreezerSelection}
        hasMealSelection={hasMealSelection}
        hasNoteOnly={hasNoteOnly}
        isToday={isToday}
        mealLabel={mealLabel}
        onSwapOrMove={onSwapOrMove}
        responsibleMember={responsibleMember}
        visibleDates={visibleDates}
        byttMedValue={byttMedValue}
        setByttMedValue={setByttMedValue}
      />
    );
  }

  return (
    <details
      className={
        isToday
          ? "group min-w-0 max-w-full overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 ring-1 ring-emerald-100"
          : "group min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
      }
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 marker:content-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {formatWeekdayLabel(date)}
          </p>
          <p className="truncate text-base font-semibold text-slate-950">
            {mealLabel}
          </p>
          <p className="text-xs text-slate-500">{formatDateLabel(date)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isToday ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              I dag
            </span>
          ) : null}
          {hasNoteOnly ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              Notat
            </span>
          ) : null}
          {hasFreezerSelection ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
              Fryser
            </span>
          ) : null}
          {responsibleMember ? (
            <span className="max-w-32 truncate rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
              {responsibleMember.displayName}
            </span>
          ) : null}
          <span className="text-xs text-slate-400 group-open:hidden">Åpne</span>
          <span className="hidden text-xs text-slate-400 group-open:inline">
            Lukk
          </span>
        </div>
      </summary>

      <div className="min-w-0 space-y-3 border-t border-slate-200 px-3 pb-3 pt-3">
        <input name="entryDate" type="hidden" value={date} />
        <input
          name={`entryUpdatedAt:${date}`}
          type="hidden"
          value={entry.updatedAt}
        />

        {canExportDay ? (
          <a
            className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
            href={`/families/${familyId}/meal-plans/${mealPlanId}/days/${date}/calendar.ics`}
            target={calendarDownloadTarget}
          >
            Eksporter dag (.ics)
          </a>
        ) : null}

        <label className="block min-w-0 text-sm font-medium text-slate-700">
          Middag
          <select
            className="mt-2 box-border w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            name={`mealSelection:${date}`}
            onChange={(event) => onMealSelectionChange(event.target.value)}
            value={mealSelection}
          >
            <option value="">Velg middag</option>
            {recipes.length > 0 ? (
              <optgroup label="Oppskrifter">
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={`recipe:${recipe.id}`}>
                    {formatMealPlanRecipeSelectLabel(recipe.title, recipe.tags)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {selectableFreezerItems.length > 0 ? (
              <optgroup label="Fryser">
                {selectableFreezerItems.map((item) => (
                  <option key={item.id} value={`freezer:${item.id}`}>
                    Fryser · {item.label} ({item.quantity} igjen)
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          {parsedSelection.recipeId ? (
            <Link
              className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
              to={`/families/${familyId}/recipes/${parsedSelection.recipeId}`}
            >
              Se oppskrift
            </Link>
          ) : null}
        </label>

        <label className="block min-w-0 text-sm font-medium text-slate-700">
          Ansvarlig
          <select
            className="mt-2 box-border w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            name={`responsibleUserId:${date}`}
            onChange={(event) =>
              setSelectedResponsibleUserId(event.target.value)
            }
            value={selectedResponsibleUserId}
          >
            <option value="">Ingen valgt</option>
            {familyMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0 text-sm font-medium text-slate-700">
          Notat
          <textarea
            className="mt-2 box-border min-h-24 w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            defaultValue={entry.note}
            name={`note:${date}`}
            placeholder="F.eks. bytt ut ris med pasta eller husk rester til dagen etter"
          />
        </label>

        <div className="min-w-0 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
          <p className="wrap-break-word text-sm leading-6 text-slate-600">
            {selectedRecipe
              ? `${selectedRecipe.description ?? "Ingen beskrivelse."} · ${selectedRecipe.prepMinutes ?? "?"} min · ${selectedRecipe.defaultServings ?? "?"} personer`
              : selectedFreezerItem
                ? selectedFreezerItem.note
                  ? `Fryserrett. ${selectedFreezerItem.note}`
                  : "Fryserrett valgt for denne dagen."
                : entry.note
                  ? "Bare notat lagres for denne dagen."
                  : "Ingen rett valgt enda."}
          </p>

          {selectedRecipe?.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedRecipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function MealPlanReorderDayRow({
  byttMedValue,
  date,
  formFields,
  hasFreezerSelection,
  hasMealSelection,
  hasNoteOnly,
  isToday,
  mealLabel,
  onSwapOrMove,
  responsibleMember,
  setByttMedValue,
  visibleDates,
}: {
  byttMedValue: string;
  date: string;
  formFields: ReactNode;
  hasFreezerSelection: boolean;
  hasMealSelection: boolean;
  hasNoteOnly: boolean;
  isToday: boolean;
  mealLabel: string;
  onSwapOrMove: (fromDate: string, toDate: string) => void;
  responsibleMember: MealPlanFamilyMemberOption | null;
  setByttMedValue: (value: string) => void;
  visibleDates: string[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLSpanElement | null>(null);

  const [{ isDragging }, drag] = useDrag(
    () => ({
      canDrag: hasMealSelection,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      item: {
        date,
        type: MEAL_PLAN_DAY_MEAL,
      } satisfies MealDayDragItem,
      type: MEAL_PLAN_DAY_MEAL,
    }),
    [date, hasMealSelection],
  );

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: MEAL_PLAN_DAY_MEAL,
      canDrop: (item: MealDayDragItem) => item.date !== date,
      collect: (monitor) => ({
        canDrop: monitor.canDrop(),
        isOver: monitor.isOver({ shallow: true }),
      }),
      drop: (item: MealDayDragItem) => {
        if (item.date === date) {
          return;
        }

        onSwapOrMove(item.date, date);
      },
    }),
    [date, onSwapOrMove],
  );

  drag(handleRef);
  drop(ref);

  const dropHighlight = isOver && canDrop;
  const rowClassName = [
    "min-w-0 max-w-full overflow-hidden rounded-2xl border p-3",
    isToday
      ? "border-emerald-200 bg-emerald-50 ring-1 ring-emerald-100"
      : "border-slate-200 bg-slate-50",
    isDragging ? "opacity-50" : "",
    dropHighlight ? "ring-2 ring-emerald-400" : "",
    hasMealSelection ? "active:cursor-grabbing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rowClassName} ref={ref}>
      {formFields}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={
              hasMealSelection
                ? "mt-1 shrink-0 cursor-grab touch-none rounded-xl border border-dashed border-slate-300 bg-white px-2.5 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 active:cursor-grabbing"
                : "mt-1 shrink-0 rounded-xl border border-dashed border-slate-200 bg-slate-100 px-2.5 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-300"
            }
            onMouseDown={(event) => {
              if (!hasMealSelection) {
                return;
              }

              event.stopPropagation();
            }}
            onTouchStart={(event) => {
              if (!hasMealSelection) {
                return;
              }

              event.stopPropagation();
            }}
            ref={hasMealSelection ? handleRef : undefined}
          >
            Dra
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {formatWeekdayLabel(date)}
            </p>
            <p className="truncate text-base font-semibold text-slate-950">
              {mealLabel}
            </p>
            <p className="text-xs text-slate-500">{formatDateLabel(date)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isToday ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              I dag
            </span>
          ) : null}
          {hasNoteOnly ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              Notat
            </span>
          ) : null}
          {hasFreezerSelection ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
              Fryser
            </span>
          ) : null}
          {responsibleMember ? (
            <span className="max-w-32 truncate rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
              {responsibleMember.displayName}
            </span>
          ) : null}
        </div>
      </div>

      {hasMealSelection ? (
        <div className="mt-3">
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            Bytt med
            <select
              aria-label="Bytt middag med annen dag"
              className="mt-2 box-border w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              onChange={(event) => {
                const targetDate = event.target.value;
                setByttMedValue("");
                if (!targetDate) {
                  return;
                }

                onSwapOrMove(date, targetDate);
              }}
              value={byttMedValue}
            >
              <option value="">Velg dag…</option>
              {visibleDates
                .filter((otherDate) => otherDate !== date)
                .map((otherDate) => (
                  <option key={otherDate} value={otherDate}>
                    {formatWeekdayLabel(otherDate)} ·{" "}
                    {formatDateLabel(otherDate)}
                  </option>
                ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function getMealDaySummaryLabel(
  entry: MealPlanEntryFormState,
  selectedRecipe: MealPlanRecipeOption | null,
  selectedFreezerItem: MealPlanFreezerOption | null,
) {
  return getDinnerMenuLabel({
    freezerItem: selectedFreezerItem
      ? { label: selectedFreezerItem.label }
      : null,
    freezerItemId: selectedFreezerItem?.id ?? null,
    note: entry.note,
    recipe: selectedRecipe ? { title: selectedRecipe.title } : null,
    recipeId: selectedRecipe?.id ?? null,
  });
}

function formatDateLabel(date: string) {
  return formatShortDateLabel(date);
}

function formatWeekdayLabel(date: string) {
  const label = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00.000Z`));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isUtcMonday(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay() === 1;
}

function formatWeekChunkLabel(date: string) {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const dayOffset = (parsedDate.getUTCDay() + 6) % 7;
  const weekStart = new Date(parsedDate.getTime());
  weekStart.setUTCDate(weekStart.getUTCDate() - dayOffset);
  const weekEnd = new Date(weekStart.getTime());
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  return `${formatDateLabel(formatDateOnly(weekStart))} – ${formatDateLabel(formatDateOnly(weekEnd))}`;
}
