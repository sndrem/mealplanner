import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { createCalendarFile, downloadCalendarFile } from "./calendar";
import {
  buildShoppingItems,
  cloneWeek,
  createBlankWeek,
  createDefaultPrototypeState,
  getDateForWeekDay,
  getDayLabel,
  getItemsDueToday,
  getItemsLater,
  getPlannedMealCount,
  getRecipeById,
  getShoppingProgress,
  getStoreById,
  getStoreOrder,
  getVisibleDays,
  getWeekById,
  getWeekWindowLabel,
  ingredientCategories,
  moveCategoryOrder,
  recipes,
  stores,
  type BuyOnDay,
  type DayId,
  type IngredientCategory,
  type MealPlanWeek,
  type PrototypeState,
  type PrototypeTab,
  type ShoppingItem,
  type Store,
} from "./model";
import { usePrototypeState } from "./storage";

type ShoppingSection = IngredientCategory | "Annen butikk";

interface ManualItemDraft {
  name: string;
  quantity: string;
  category: IngredientCategory;
  preferredStoreId: string;
  buyOnDay: BuyOnDay;
  note: string;
}

interface WeekDraft {
  title: string;
  startDate: string;
  endDate: string;
}

const inputClassName =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

const defaultManualDraft: ManualItemDraft = {
  name: "",
  quantity: "",
  category: ingredientCategories[0],
  preferredStoreId: "",
  buyOnDay: "now",
  note: "",
};

const tabLabels: Record<PrototypeTab, string> = {
  plan: "Ukeplan",
  liste: "Handleliste",
  butikk: "Butikkmodus",
  butikker: "Butikker",
};

export function MealPlannerPrototype() {
  let { hydrated, state, setState } = usePrototypeState();
  let selectedWeek = getWeekById(state, state.selectedWeekId) ?? state.weeks[0];
  let visibleDays = getVisibleDays(selectedWeek);
  let isStoreMode = state.activeTab === "butikk";
  let [manualDraft, setManualDraft] = useState<ManualItemDraft>({
    ...defaultManualDraft,
    buyOnDay: visibleDays[0] ?? "now",
  });

  let activeStore = getStoreById(state.selectedStoreId) ?? stores[0];
  let activeStoreOrder = getStoreOrder(state, activeStore.id);
  let selectedRecipeIds = new Set(
    visibleDays.map((dayId) => selectedWeek.mealPlan[dayId]).filter(Boolean),
  );

  let shoppingItems = useMemo(
    () => buildShoppingItems(selectedWeek),
    [selectedWeek],
  );
  let dueItems = useMemo(
    () => getItemsDueToday(shoppingItems, selectedWeek.shoppingDay),
    [shoppingItems, selectedWeek.shoppingDay],
  );
  let laterItems = useMemo(
    () => getItemsLater(shoppingItems, selectedWeek.shoppingDay),
    [shoppingItems, selectedWeek.shoppingDay],
  );

  let visibleShoppingItems = useMemo(() => {
    if (state.shoppingFilter === "today") return dueItems;
    if (state.shoppingFilter === "later") return laterItems;
    return shoppingItems;
  }, [dueItems, laterItems, shoppingItems, state.shoppingFilter]);

  let groupedItems = useMemo(
    () =>
      groupItemsBySection(visibleShoppingItems, activeStore, activeStoreOrder),
    [activeStore, activeStoreOrder, visibleShoppingItems],
  );

  let checkedItemIds = new Set(selectedWeek.checkedItemIds);
  let plannedMealCount = getPlannedMealCount(selectedWeek);
  let shoppingProgress = getShoppingProgress(selectedWeek, dueItems);
  let openLaterCount = laterItems.filter(
    (item) => !checkedItemIds.has(item.id),
  ).length;
  let nextWeekStartDate = getNextWeekStartDate(state.weeks);
  let [weekDraft, setWeekDraft] = useState<WeekDraft>(() =>
    createWeekDraft(`Ny uke ${state.weeks.length + 1}`, nextWeekStartDate),
  );

  function updateState(recipe: (current: PrototypeState) => PrototypeState) {
    setState(recipe);
  }

  function updateSelectedWeek(recipe: (week: MealPlanWeek) => MealPlanWeek) {
    updateState((current) => ({
      ...current,
      weeks: current.weeks.map((week) =>
        week.id === current.selectedWeekId ? recipe(week) : week,
      ),
    }));
  }

  function selectWeek(weekId: string) {
    let nextWeek = getWeekById(state, weekId);
    if (!nextWeek) return;

    setManualDraft((current) => ({
      ...current,
      buyOnDay: getVisibleDays(nextWeek)[0] ?? "now",
    }));

    updateState((current) => ({
      ...current,
      selectedWeekId: weekId,
    }));
  }

  function setActiveTab(activeTab: PrototypeTab) {
    updateState((current) => ({ ...current, activeTab }));
  }

  function updateMealPlan(dayId: DayId, recipeId: string) {
    updateSelectedWeek((week) => ({
      ...week,
      planApproved: false,
      mealPlan: {
        ...week.mealPlan,
        [dayId]: recipeId || null,
      },
    }));
  }

  function autoFillWeek() {
    updateSelectedWeek((week) => ({
      ...week,
      planApproved: false,
      mealPlan: {
        ...week.mealPlan,
        ...Object.fromEntries(
          getVisibleDays(week).map((dayId, index) => [
            dayId,
            recipes[index % recipes.length].id,
          ]),
        ),
      },
      checkedItemIds: [],
      postponedItemDays: {},
    }));
  }

  function clearWeekPlan() {
    updateSelectedWeek((week) => ({
      ...week,
      planApproved: false,
      mealPlan: {
        ...week.mealPlan,
        ...Object.fromEntries(
          getVisibleDays(week).map((dayId) => [dayId, null]),
        ),
      },
      checkedItemIds: [],
      postponedItemDays: {},
    }));
  }

  function toggleApproved() {
    updateSelectedWeek((week) => ({
      ...week,
      planApproved: !week.planApproved,
    }));
  }

  function toggleChecked(itemId: string) {
    updateSelectedWeek((week) => ({
      ...week,
      checkedItemIds: week.checkedItemIds.includes(itemId)
        ? week.checkedItemIds.filter((value) => value !== itemId)
        : [...week.checkedItemIds, itemId],
    }));
  }

  function postponeItem(itemId: string, buyOnDay: BuyOnDay) {
    updateSelectedWeek((week) => ({
      ...week,
      postponedItemDays: {
        ...week.postponedItemDays,
        [itemId]: buyOnDay,
      },
    }));
  }

  function moveStoreCategory(
    category: IngredientCategory,
    direction: "up" | "down",
  ) {
    updateState((current) => ({
      ...current,
      storeOrders: {
        ...current.storeOrders,
        [activeStore.id]: moveCategoryOrder(
          getStoreOrder(current, activeStore.id),
          category,
          direction,
        ),
      },
    }));
  }

  function createNextWeek() {
    let title = weekDraft.title.trim() || `Ny uke ${state.weeks.length + 1}`;
    let week = createBlankWeek(title, weekDraft.startDate, weekDraft.endDate);
    setManualDraft((current) => ({
      ...current,
      buyOnDay: getVisibleDays(week)[0] ?? "now",
    }));
    setWeekDraft(
      createWeekDraft(
        `Ny uke ${state.weeks.length + 2}`,
        getNextWeekStartDate([...state.weeks, week]),
      ),
    );
    updateState((current) => ({
      ...current,
      selectedWeekId: week.id,
      weeks: [...current.weeks, week],
      activeTab: "plan",
    }));
  }

  function reuseSelectedWeek() {
    let title = weekDraft.title.trim() || `${selectedWeek.title} kopi`;
    let weekCopy = cloneWeek(
      selectedWeek,
      title,
      weekDraft.startDate,
      weekDraft.endDate,
    );
    setManualDraft((current) => ({
      ...current,
      buyOnDay: getVisibleDays(weekCopy)[0] ?? "now",
    }));
    setWeekDraft(
      createWeekDraft(
        `Ny uke ${state.weeks.length + 2}`,
        getNextWeekStartDate([...state.weeks, weekCopy]),
      ),
    );
    updateState((current) => ({
      ...current,
      selectedWeekId: weekCopy.id,
      weeks: [...current.weeks, weekCopy],
      activeTab: "plan",
    }));
  }

  function exportDayToCalendar(dayId: DayId) {
    let recipe = getRecipeById(selectedWeek.mealPlan[dayId]);
    if (!recipe) {
      return;
    }

    let date = getDateForWeekDay(selectedWeek, dayId);
    let content = createCalendarFile(`Mealplanner - ${selectedWeek.title}`, [
      {
        title: `Middag: ${recipe.title}`,
        date,
        description: `${capitalize(getDayLabel(dayId))} i ${selectedWeek.title}. ${recipe.description}`,
      },
    ]);

    downloadCalendarFile(`${toSlug(selectedWeek.title)}-${dayId}.ics`, content);
  }

  function exportWeekToCalendar() {
    let events = visibleDays.flatMap((dayId) => {
      let recipe = getRecipeById(selectedWeek.mealPlan[dayId]);
      if (!recipe) {
        return [];
      }

      return [
        {
          title: `Middag: ${recipe.title}`,
          date: getDateForWeekDay(selectedWeek, dayId),
          description: `${capitalize(getDayLabel(dayId))} i ${selectedWeek.title}. ${recipe.description}`,
        },
      ];
    });

    if (events.length === 0) {
      return;
    }

    let content = createCalendarFile(
      `Mealplanner - ${selectedWeek.title}`,
      events,
    );
    downloadCalendarFile(`${toSlug(selectedWeek.title)}-ukeplan.ics`, content);
  }

  function addManualItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualDraft.name.trim()) {
      return;
    }

    updateSelectedWeek((week) => ({
      ...week,
      manualItems: [
        ...week.manualItems,
        {
          id: `manual-${Date.now()}`,
          name: manualDraft.name.trim(),
          quantity: manualDraft.quantity.trim() || "1 stk",
          category: manualDraft.category,
          preferredStoreId: manualDraft.preferredStoreId || undefined,
          buyOnDay: manualDraft.buyOnDay,
          note: manualDraft.note.trim() || undefined,
        },
      ],
    }));

    setManualDraft({
      ...defaultManualDraft,
      buyOnDay: visibleDays[0] ?? "now",
    });

    setActiveTab("liste");
  }

  function removeManualItem(itemId: string) {
    let manualId = itemId.split(":manual:")[1];
    if (!manualId) return;

    updateSelectedWeek((week) => ({
      ...week,
      manualItems: week.manualItems.filter((item) => item.id !== manualId),
      checkedItemIds: week.checkedItemIds.filter((value) => value !== itemId),
    }));
  }

  function resetPrototype() {
    setState(createDefaultPrototypeState());
    setManualDraft(defaultManualDraft);
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-20 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-xl">
          <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Prototype
              </span>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  Ukeplan og handleliste for familier som planlegger flere uker
                  samtidig.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Denne versjonen tester flere planuker, gjenbruk av tidligere
                  uker og aktive uker som kan starte midt i kalenderuken, for
                  eksempel pa torsdag.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-200">
                <InfoPill label="Sprak" value="Norsk" />
                <InfoPill
                  label="Oppsett"
                  value={`${state.weeks.length} planuker`}
                />
                <InfoPill
                  label="Lagring"
                  value={hydrated ? "LocalStorage aktiv" : "Laster demo-data"}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <StatCard
                label={`Planlagte middager i ${selectedWeek.title.toLowerCase()}`}
                value={`${plannedMealCount}/${visibleDays.length}`}
                tone="emerald"
              />
              <StatCard
                label="Klar for ukeshandel"
                value={`${shoppingProgress.totalCount - shoppingProgress.checkedCount} varer`}
                tone="sky"
              />
              <StatCard
                label="Senere i perioden"
                value={`${openLaterCount} varer`}
                tone="amber"
              />
            </div>
          </div>
        </header>

        <section className="rounded-[28px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Navigasjon</p>
              <p className="text-sm text-slate-600">
                Bytt raskt mellom planlegging, handleliste, butikkmodus og
                butikkoppsett.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex">
              {Object.entries(tabLabels).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setActiveTab(tabId as PrototypeTab)}
                  className={
                    state.activeTab === tabId
                      ? "rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
                      : "rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {isStoreMode ? (
          <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500">
                  Klar til a handle
                </p>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Sjekk butikk og uke, sa er du klar.
                </h2>
                <div className="flex flex-wrap gap-2">
                  <InfoPill
                    label="Periode"
                    value={getWeekWindowLabel(selectedWeek)}
                    dark={false}
                  />
                  <InfoPill
                    label="Datoer"
                    value={`${formatDateLabel(getDateForWeekDay(selectedWeek, visibleDays[0]))} - ${formatDateLabel(
                      getDateForWeekDay(
                        selectedWeek,
                        visibleDays[visibleDays.length - 1],
                      ),
                    )}`}
                    dark={false}
                  />
                  <InfoPill
                    label="Handledag"
                    value={capitalize(getDayLabel(selectedWeek.shoppingDay))}
                    dark={false}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[30rem]">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Planuke</span>
                  <select
                    className={inputClassName}
                    value={selectedWeek.id}
                    onChange={(event) => selectWeek(event.target.value)}
                  >
                    {state.weeks.map((week) => (
                      <option key={week.id} value={week.id}>
                        {week.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Butikk</span>
                  <select
                    className={inputClassName}
                    value={activeStore.id}
                    onChange={(event) =>
                      updateState((current) => ({
                        ...current,
                        selectedStoreId: event.target.value,
                      }))
                    }
                  >
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <SectionCard
                title="Planuker"
                description="Velg mellom aktive og kommende uker. Den aktive uken kan starte midt i uken, mens kommende uker planlegges fra mandag."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <article className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-4 md:col-span-2">
                    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                      <label className="grid gap-1.5 text-sm">
                        <span className="font-medium text-slate-700">
                          Tittel
                        </span>
                        <input
                          className={inputClassName}
                          value={weekDraft.title}
                          onChange={(event) =>
                            setWeekDraft((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          placeholder="F.eks. Høstferie uke"
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm">
                        <span className="font-medium text-slate-700">
                          Startdato
                        </span>
                        <input
                          className={inputClassName}
                          type="date"
                          value={weekDraft.startDate}
                          onChange={(event) =>
                            setWeekDraft((current) => {
                              let startDate = event.target.value;
                              let maxEndDate = addDaysToDateString(
                                startDate,
                                6,
                              );
                              let endDate = current.endDate;
                              if (endDate < startDate) endDate = startDate;
                              if (endDate > maxEndDate) endDate = maxEndDate;

                              return {
                                ...current,
                                startDate,
                                endDate,
                              };
                            })
                          }
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm">
                        <span className="font-medium text-slate-700">
                          Sluttdato
                        </span>
                        <input
                          className={inputClassName}
                          type="date"
                          min={weekDraft.startDate}
                          max={addDaysToDateString(weekDraft.startDate, 6)}
                          value={weekDraft.endDate}
                          onChange={(event) =>
                            setWeekDraft((current) => ({
                              ...current,
                              endDate: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <div className="flex flex-col justify-end gap-2">
                        <ActionButton onClick={createNextWeek}>
                          Ny tom uke
                        </ActionButton>
                        <ActionButton onClick={reuseSelectedWeek} tone="subtle">
                          Gjenbruk valgt uke
                        </ActionButton>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-slate-600">
                      Velg start- og sluttdato for planuken. Prototypen tillater
                      opptil 7 dager per uke.
                    </p>
                  </article>

                  {state.weeks.map((week) => (
                    <WeekCard
                      key={week.id}
                      week={week}
                      selected={week.id === selectedWeek.id}
                      onSelect={() => selectWeek(week.id)}
                    />
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Aktiv periode"
                description="Viser hvilken del av uken som fortsatt er relevant a planlegge og handle for."
              >
                <div className="grid gap-4">
                  <SelectorCard
                    label="Valgt uke"
                    value={selectedWeek.title}
                    description={
                      selectedWeek.copiedFromWeekId
                        ? "Denne uken er laget ved a gjenbruke en tidligere uke."
                        : "Bytt uke over for a se plan, handleliste og butikkmodus."
                    }
                  >
                    <div className="flex flex-wrap gap-2">
                      <InfoPill
                        label="Periode"
                        value={getWeekWindowLabel(selectedWeek)}
                        dark={false}
                      />
                      <InfoPill
                        label="Datoer"
                        value={`${formatDateLabel(getDateForWeekDay(selectedWeek, visibleDays[0]))} - ${formatDateLabel(
                          getDateForWeekDay(
                            selectedWeek,
                            visibleDays[visibleDays.length - 1],
                          ),
                        )}`}
                        dark={false}
                      />
                      <InfoPill
                        label="Handledag"
                        value={capitalize(
                          getDayLabel(selectedWeek.shoppingDay),
                        )}
                        dark={false}
                      />
                      <InfoPill
                        label="Status"
                        value={
                          selectedWeek.planApproved ? "Godkjent" : "Utkast"
                        }
                        dark={false}
                      />
                    </div>
                  </SelectorCard>
                </div>
              </SectionCard>
            </div>

            <section className="grid gap-3 rounded-[28px] bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2 xl:grid-cols-3">
              <SelectorCard
                label="Handledag"
                value={capitalize(getDayLabel(selectedWeek.shoppingDay))}
                description="Bare dager i den aktive perioden kan velges for denne uken."
              >
                <select
                  className={inputClassName}
                  value={selectedWeek.shoppingDay}
                  onChange={(event) =>
                    updateSelectedWeek((week) => ({
                      ...week,
                      shoppingDay: event.target.value as DayId,
                    }))
                  }
                >
                  {visibleDays.map((dayId) => (
                    <option key={dayId} value={dayId}>
                      {capitalize(getDayLabel(dayId))}
                    </option>
                  ))}
                </select>
              </SelectorCard>

              <SelectorCard
                label="Butikk"
                value={activeStore.name}
                description="Sorter handlelisten etter rekkefolgen dere gar i butikken."
              >
                <select
                  className={inputClassName}
                  value={activeStore.id}
                  onChange={(event) =>
                    updateState((current) => ({
                      ...current,
                      selectedStoreId: event.target.value,
                    }))
                  }
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </SelectorCard>

              <SelectorCard
                label="Handlefilter"
                value={filterLabel(state.shoppingFilter)}
                description="Brukes bade i handleliste og butikkmodus."
              >
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "today", label: "Na" },
                    { id: "later", label: "Senere" },
                    { id: "all", label: "Alle" },
                  ].map((filterOption) => (
                    <button
                      key={filterOption.id}
                      type="button"
                      onClick={() =>
                        updateState((current) => ({
                          ...current,
                          shoppingFilter:
                            filterOption.id as PrototypeState["shoppingFilter"],
                        }))
                      }
                      className={
                        state.shoppingFilter === filterOption.id
                          ? "rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white"
                          : "rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                      }
                    >
                      {filterOption.label}
                    </button>
                  ))}
                </div>
              </SelectorCard>
            </section>
          </>
        )}

        {state.activeTab === "plan" ? (
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
            <SectionCard
              title={`Ukeplan: ${selectedWeek.title}`}
              description={`Planlegg bare den aktive delen av uken. Denne perioden dekker ${getWeekWindowLabel(
                selectedWeek,
              )}.`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <ActionButton onClick={autoFillWeek}>
                    Fyll perioden automatisk
                  </ActionButton>
                  <ActionButton onClick={exportWeekToCalendar} tone="subtle">
                    Eksporter uke til iCal
                  </ActionButton>
                  <ActionButton onClick={clearWeekPlan} tone="subtle">
                    Tom periode
                  </ActionButton>
                  <ActionButton
                    onClick={toggleApproved}
                    tone={selectedWeek.planApproved ? "success" : "primary"}
                  >
                    {selectedWeek.planApproved
                      ? "Godkjent av familien"
                      : "Marker som godkjent"}
                  </ActionButton>
                </div>
              }
            >
              <div className="grid gap-3">
                {visibleDays.map((dayId) => (
                  <DayPlanCard
                    key={dayId}
                    dayLabel={capitalize(getDayLabel(dayId))}
                    dateLabel={formatDateLabel(
                      getDateForWeekDay(selectedWeek, dayId),
                    )}
                    recipe={getRecipeById(selectedWeek.mealPlan[dayId])}
                    selectedRecipeId={selectedWeek.mealPlan[dayId] ?? ""}
                    onExport={() => exportDayToCalendar(dayId)}
                    onChange={(recipeId) => updateMealPlan(dayId, recipeId)}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Oppskriftsbank"
              description="Seedede oppskrifter for a teste flyten. Gjenbrukte uker kan kopiere kombinasjoner som fungerer bra."
            >
              <div className="grid gap-3">
                {recipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    selected={selectedRecipeIds.has(recipe.id)}
                  />
                ))}
              </div>
            </SectionCard>
          </div>
        ) : null}

        {state.activeTab === "liste" ? (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <SectionCard
              title={`Legg til vare i ${selectedWeek.title.toLowerCase()}`}
              description="Bruk dette til husholdningsvarer, helgekos eller alt som ikke kommer fra en oppskrift."
            >
              <form className="grid gap-3" onSubmit={addManualItem}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-slate-700">Vare</span>
                    <input
                      className={inputClassName}
                      value={manualDraft.name}
                      onChange={(event) =>
                        setManualDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="F.eks. dopapir eller tacochips"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-slate-700">Mengde</span>
                    <input
                      className={inputClassName}
                      value={manualDraft.quantity}
                      onChange={(event) =>
                        setManualDraft((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                      placeholder="F.eks. 2 poser"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-slate-700">Kategori</span>
                    <select
                      className={inputClassName}
                      value={manualDraft.category}
                      onChange={(event) =>
                        setManualDraft((current) => ({
                          ...current,
                          category: event.target.value as IngredientCategory,
                        }))
                      }
                    >
                      {ingredientCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-slate-700">Butikk</span>
                    <select
                      className={inputClassName}
                      value={manualDraft.preferredStoreId}
                      onChange={(event) =>
                        setManualDraft((current) => ({
                          ...current,
                          preferredStoreId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Alle butikker</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-slate-700">Kjopes</span>
                    <select
                      className={inputClassName}
                      value={manualDraft.buyOnDay}
                      onChange={(event) =>
                        setManualDraft((current) => ({
                          ...current,
                          buyOnDay: event.target.value as BuyOnDay,
                        }))
                      }
                    >
                      <option value="now">Sa snart som mulig</option>
                      {visibleDays.map((dayId) => (
                        <option key={dayId} value={dayId}>
                          {capitalize(getDayLabel(dayId))}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Notat</span>
                  <input
                    className={inputClassName}
                    value={manualDraft.note}
                    onChange={(event) =>
                      setManualDraft((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                    placeholder="F.eks. kun hvis det er tilbud"
                  />
                </label>

                <div className="flex justify-end">
                  <ActionButton type="submit">Legg til vare</ActionButton>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title={`Handleliste: ${selectedWeek.title}`}
              description="Generert fra den valgte planuken. Hver uke har sin egen handleliste og egne utsatte varer."
            >
              <div className="mb-4 flex flex-wrap gap-2 text-sm text-slate-600">
                <InfoPill
                  label="Butikk"
                  value={activeStore.name}
                  dark={false}
                />
                <InfoPill
                  label="Periode"
                  value={getWeekWindowLabel(selectedWeek)}
                  dark={false}
                />
                <InfoPill
                  label="Filter"
                  value={filterLabel(state.shoppingFilter)}
                  dark={false}
                />
                <InfoPill
                  label="Na"
                  value={`${dueItems.length} varer`}
                  dark={false}
                />
                <InfoPill
                  label="Senere"
                  value={`${laterItems.length} varer`}
                  dark={false}
                />
              </div>

              <div className="space-y-4">
                {groupedItems.length === 0 ? (
                  <EmptyState
                    title="Ingen varer i dette filteret"
                    description="Velg flere middager eller legg til egne varer for a se handlelisten her."
                  />
                ) : (
                  groupedItems.map((group) => (
                    <ShoppingGroup
                      key={group.section}
                      title={group.section}
                      items={group.items}
                      checkedItemIds={checkedItemIds}
                      availableDays={visibleDays}
                      onToggleChecked={toggleChecked}
                      onPostpone={postponeItem}
                      onRemoveManualItem={removeManualItem}
                    />
                  ))
                )}
              </div>
            </SectionCard>
          </div>
        ) : null}

        {state.activeTab === "butikk" ? (
          <SectionCard
            title={`Butikkmodus: ${selectedWeek.title}`}
            description="Store trykkflater, tydelig progresjon og fokus pa varene som skal handles akkurat na for den valgte uken."
          >
            <div className="mb-5 grid gap-3 rounded-[28px] bg-slate-950 p-4 text-white sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">Aktiv butikk</p>
                <p className="mt-1 text-lg font-semibold">{activeStore.name}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">Handledag</p>
                <p className="mt-1 text-lg font-semibold">
                  {capitalize(getDayLabel(selectedWeek.shoppingDay))}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-500/20 p-4 ring-1 ring-emerald-400/30">
                <p className="text-sm text-emerald-100">Fremdrift</p>
                <p className="mt-1 text-lg font-semibold">
                  {shoppingProgress.checkedCount}/{shoppingProgress.totalCount}{" "}
                  krysset av
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {groupItemsBySection(dueItems, activeStore, activeStoreOrder)
                .length === 0 ? (
                <EmptyState
                  title="Ingen varer ma handles na"
                  description="Alt er enten ferdig handlet eller utsatt til senere i den valgte uken."
                />
              ) : (
                groupItemsBySection(
                  dueItems,
                  activeStore,
                  activeStoreOrder,
                ).map((group) => (
                  <div key={group.section} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {group.section}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {group.items.length} varer
                      </span>
                    </div>

                    <div className="grid gap-3">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleChecked(item.id)}
                          className={
                            checkedItemIds.has(item.id)
                              ? "flex items-start gap-4 rounded-[28px] border border-emerald-200 bg-emerald-50 p-4 text-left shadow-sm"
                              : "flex items-start gap-4 rounded-[28px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
                          }
                        >
                          <span
                            className={
                              checkedItemIds.has(item.id)
                                ? "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white"
                                : "mt-1 h-6 w-6 shrink-0 rounded-full border-2 border-slate-300"
                            }
                          >
                            {checkedItemIds.has(item.id) ? "✓" : ""}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-slate-900">
                                {item.name}
                              </p>
                              <Badge>{item.quantity}</Badge>
                              {item.source === "manual" ? (
                                <Badge tone="amber">Manuell</Badge>
                              ) : null}
                              {item.preferredStoreId &&
                              item.preferredStoreId !== activeStore.id ? (
                                <Badge tone="sky">
                                  {getStoreById(item.preferredStoreId)?.name}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {item.recipeName
                                ? `Fra ${item.recipeName} pa ${getDayLabel(item.dayId!)}`
                                : item.note || "Egen vare lagt til av familien"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}

              <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Varer som er utsatt til senere
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {laterItems.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Ingen utsatte varer akkurat na.
                    </p>
                  ) : (
                    laterItems.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200"
                      >
                        {item.name} · {buyOnLabel(item.buyOnDay)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {state.activeTab === "butikker" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <SectionCard
              title="Butikkoppsett"
              description="Tilpass rekkefolgen sa listen folger gangmønsteret deres i butikken."
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() =>
                      updateState((current) => ({
                        ...current,
                        selectedStoreId: store.id,
                      }))
                    }
                    className={
                      activeStore.id === store.id
                        ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                        : "rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                    }
                  >
                    {store.name}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {activeStoreOrder.map((category, index) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div>
                      <p className="text-sm text-slate-500">
                        Plass {index + 1}
                      </p>
                      <p className="font-medium text-slate-900">{category}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveStoreCategory(category, "up")}
                        className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                      >
                        Opp
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStoreCategory(category, "down")}
                        className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                      >
                        Ned
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Neste steg"
              description="Denne prototypen modellerer na flere planuker og gjenbruk, men bruker fortsatt lokal demo-data."
            >
              <div className="space-y-4 text-sm leading-6 text-slate-600">
                <p>
                  Dagens prototype tester kjerneverdien: planlegg flere uker,
                  gjenbruk en uke som fungerte bra, og bruk en mobilvennlig
                  butikkvisning for hver enkelt uke.
                </p>
                <ul className="space-y-2">
                  <li className="rounded-2xl bg-slate-50 px-4 py-3">
                    Neste naturlige steg er a koble pa ekte lagring med Prisma
                    og PostgreSQL.
                  </li>
                  <li className="rounded-2xl bg-slate-50 px-4 py-3">
                    Deretter kan familiekontoer og godkjenning mellom flere
                    brukere legges pa.
                  </li>
                  <li className="rounded-2xl bg-slate-50 px-4 py-3">
                    Notion-import kan passe inn som en mate a fylle
                    oppskriftsbanken pa uten a endre UI-flyten.
                  </li>
                </ul>

                <div className="pt-2">
                  <ActionButton onClick={resetPrototype} tone="subtle">
                    Tilbakestill demo-data
                  </ActionButton>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function SelectorCard({
  label,
  value,
  description,
  children,
}: {
  label: string;
  value: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] bg-slate-50 p-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="text-base font-semibold text-slate-950">{value}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}

function WeekCard({
  week,
  selected,
  onSelect,
}: {
  week: MealPlanWeek;
  selected: boolean;
  onSelect: () => void;
}) {
  let visibleDays = getVisibleDays(week);
  let plannedMealCount = getPlannedMealCount(week);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        selected
          ? "rounded-[28px] border border-emerald-200 bg-emerald-50 p-4 text-left shadow-sm"
          : "rounded-[28px] border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:border-slate-300"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{week.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Aktiv periode: {getWeekWindowLabel(week)} · {plannedMealCount}/
            {visibleDays.length} middager planlagt
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateLabel(getDateForWeekDay(week, visibleDays[0]))} -{" "}
            {formatDateLabel(
              getDateForWeekDay(week, visibleDays[visibleDays.length - 1]),
            )}
          </p>
        </div>
        {week.planApproved ? (
          <Badge tone="success">Godkjent</Badge>
        ) : (
          <Badge>Utkast</Badge>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleDays.map((dayId) => (
          <Badge key={dayId}>{capitalize(getDayLabel(dayId))}</Badge>
        ))}
        {week.copiedFromWeekId ? <Badge tone="sky">Gjenbrukt uke</Badge> : null}
      </div>
    </button>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "amber";
}) {
  let toneClassName =
    tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/20"
      : tone === "sky"
        ? "bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/20"
        : "bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/20";

  return (
    <div className={`rounded-[28px] p-4 ${toneClassName}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoPill({
  label,
  value,
  dark = true,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <span
      className={
        dark
          ? "inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white"
          : "inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
      }
    >
      <span className={dark ? "text-slate-300" : "text-slate-500"}>
        {label}
      </span>
      <span>{value}</span>
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  tone = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "success" | "subtle";
  type?: "button" | "submit";
}) {
  let className =
    tone === "primary"
      ? "rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
      : tone === "success"
        ? "rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
        : "rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200";

  return (
    <button type={type} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function DayPlanCard({
  dayLabel,
  dateLabel,
  selectedRecipeId,
  recipe,
  onExport,
  onChange,
}: {
  dayLabel: string;
  dateLabel: string;
  selectedRecipeId: string;
  recipe: ReturnType<typeof getRecipeById>;
  onExport: () => void;
  onChange: (recipeId: string) => void;
}) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            Middag
          </p>
          <h3 className="text-lg font-semibold text-slate-950">{dayLabel}</h3>
          <p className="text-sm font-medium text-slate-500">{dateLabel}</p>
          <p className="text-sm leading-6 text-slate-600">
            {recipe
              ? `${recipe.description} · ${recipe.prepMinutes} min · ${recipe.servings} personer`
              : "Ingen rett valgt enda."}
          </p>
        </div>

        <div className="w-full sm:max-w-xs">
          <select
            className={inputClassName}
            value={selectedRecipeId}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">Velg middag</option>
            {recipes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {recipe ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {recipe.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
          <ActionButton onClick={onExport} tone="subtle">
            Synk til iCal
          </ActionButton>
        </div>
      ) : null}
    </article>
  );
}

function RecipeCard({
  recipe,
  selected,
}: {
  recipe: (typeof recipes)[number];
  selected: boolean;
}) {
  return (
    <article
      className={
        selected
          ? "rounded-[28px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
          : "rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-sm"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            {recipe.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {recipe.description}
          </p>
        </div>
        {selected ? <Badge tone="success">I ukeplanen</Badge> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {recipe.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <div className="mt-4 rounded-[24px] bg-white p-3 ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-800">
          {recipe.ingredients.length} ingredienser
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {recipe.ingredients
            .slice(0, 3)
            .map((ingredient) => ingredient.name)
            .join(", ")}
          {recipe.ingredients.length > 3 ? " og mer" : ""}
        </p>
      </div>
    </article>
  );
}

function ShoppingGroup({
  title,
  items,
  checkedItemIds,
  availableDays,
  onToggleChecked,
  onPostpone,
  onRemoveManualItem,
}: {
  title: string;
  items: ShoppingItem[];
  checkedItemIds: Set<string>;
  availableDays: DayId[];
  onToggleChecked: (itemId: string) => void;
  onPostpone: (itemId: string, buyOnDay: BuyOnDay) => void;
  onRemoveManualItem: (itemId: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {items.length} varer
        </span>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className={
              checkedItemIds.has(item.id)
                ? "rounded-[28px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
                : "rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm"
            }
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleChecked(item.id)}
                    className={
                      checkedItemIds.has(item.id)
                        ? "rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white"
                        : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                    }
                  >
                    {checkedItemIds.has(item.id) ? "Kjopt" : "Marker som kjøpt"}
                  </button>
                  <p className="text-base font-semibold text-slate-950">
                    {item.name}
                  </p>
                  <Badge>{item.quantity}</Badge>
                  {item.preferredStoreId ? (
                    <Badge tone="sky">
                      {getStoreById(item.preferredStoreId)?.name}
                    </Badge>
                  ) : null}
                  {item.source === "manual" ? (
                    <Badge tone="amber">Manuell</Badge>
                  ) : null}
                </div>

                <p className="text-sm leading-6 text-slate-600">
                  {item.recipeName
                    ? `Fra ${item.recipeName} pa ${getDayLabel(item.dayId!)}`
                    : item.note || "Lagt til manuelt"}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:min-w-56">
                <label className="grid gap-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Kjopes</span>
                  <select
                    className={inputClassName}
                    value={item.buyOnDay}
                    onChange={(event) =>
                      onPostpone(item.id, event.target.value as BuyOnDay)
                    }
                  >
                    <option value="now">Sa snart som mulig</option>
                    {availableDays.map((dayId) => (
                      <option key={dayId} value={dayId}>
                        {capitalize(getDayLabel(dayId))}
                      </option>
                    ))}
                  </select>
                </label>

                {item.source === "manual" ? (
                  <button
                    type="button"
                    onClick={() => onRemoveManualItem(item.id)}
                    className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                  >
                    Fjern vare
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "success" | "sky" | "amber";
}) {
  let className =
    tone === "success"
      ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
      : tone === "sky"
        ? "rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700"
        : tone === "amber"
          ? "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"
          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700";

  return <span className={className}>{children}</span>;
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function groupItemsBySection(
  items: ShoppingItem[],
  store: Store,
  order: IngredientCategory[],
) {
  let sections = new Map<ShoppingSection, ShoppingItem[]>();

  for (let item of items) {
    let section: ShoppingSection =
      item.preferredStoreId && item.preferredStoreId !== store.id
        ? "Annen butikk"
        : item.category;
    let existing = sections.get(section);
    if (existing) {
      existing.push(item);
    } else {
      sections.set(section, [item]);
    }
  }

  let orderedSections: ShoppingSection[] = [...order];
  if (sections.has("Annen butikk")) {
    orderedSections.push("Annen butikk");
  }

  return orderedSections.flatMap((section) => {
    let sectionItems = sections.get(section);
    if (!sectionItems?.length) {
      return [];
    }

    return [
      {
        section,
        items: sectionItems,
      },
    ];
  });
}

function filterLabel(filter: PrototypeState["shoppingFilter"]) {
  if (filter === "today") return "Na";
  if (filter === "later") return "Senere";
  return "Alle";
}

function buyOnLabel(value: BuyOnDay) {
  return value === "now" ? "Na" : capitalize(getDayLabel(value));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateLabel(value: string) {
  let [year, month, day] = value.split("-").map(Number);
  let date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function createWeekDraft(title: string, startDate: string): WeekDraft {
  return {
    title,
    startDate,
    endDate: addDaysToDateString(startDate, 6),
  };
}

function getNextWeekStartDate(weeks: MealPlanWeek[]) {
  if (weeks.length === 0) {
    return todayAsDateString();
  }

  let sortedWeeks = [...weeks].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  );
  let latestWeek = sortedWeeks[sortedWeeks.length - 1];
  let [year, month, day] = latestWeek.startDate.split("-").map(Number);
  let date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 7);

  return toDateString(date);
}

function addDaysToDateString(value: string, amount: number) {
  let [year, month, day] = value.split("-").map(Number);
  let date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return toDateString(date);
}

function todayAsDateString() {
  return toDateString(new Date());
}

function toDateString(date: Date) {
  let year = date.getFullYear();
  let month = `${date.getMonth() + 1}`.padStart(2, "0");
  let day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}
