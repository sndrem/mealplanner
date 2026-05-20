export const weekDays = [
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lordag",
  "sondag",
] as const;

export type DayId = (typeof weekDays)[number];

export const ingredientCategories = [
  "Frukt og grønt",
  "Kjøtt og fisk",
  "Meieri",
  "Torrvarer",
  "Frys",
  "Bakst og brød",
  "Drikke",
  "Husholdning",
  "Annet",
] as const;

export type IngredientCategory = (typeof ingredientCategories)[number];

const legacyIngredientCategoryMap = {
  "Frukt og gront": "Frukt og grønt",
  "Kjott og fisk": "Kjøtt og fisk",
  "Bakst og brod": "Bakst og brød",
} satisfies Record<string, IngredientCategory>;

function coerceIngredientCategory(value: unknown): IngredientCategory | null {
  if (typeof value !== "string") {
    return null;
  }

  if ((ingredientCategories as readonly string[]).includes(value)) {
    return value as IngredientCategory;
  }

  let mapped =
    legacyIngredientCategoryMap[value as keyof typeof legacyIngredientCategoryMap];
  return mapped ?? null;
}

export type PrototypeTab = "plan" | "liste" | "butikk" | "butikker";
export type ShoppingFilter = "today" | "later" | "all";
export type BuyOnDay = DayId | "now";

export interface RecipeIngredient {
  id: string;
  name: string;
  amount: string;
  category: IngredientCategory;
  preferredStoreId?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  prepMinutes: number;
  servings: number;
  tags: string[];
  ingredients: RecipeIngredient[];
}

export interface Store {
  id: string;
  name: string;
  sectionOrder: IngredientCategory[];
}

export interface ManualItem {
  id: string;
  name: string;
  quantity: string;
  category: IngredientCategory;
  preferredStoreId?: string;
  buyOnDay: BuyOnDay;
  note?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  category: IngredientCategory;
  source: "recipe" | "manual";
  dayId?: DayId;
  recipeId?: string;
  recipeName?: string;
  preferredStoreId?: string;
  buyOnDay: BuyOnDay;
  note?: string;
}

export interface MealPlanWeek {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  shoppingDay: DayId;
  planApproved: boolean;
  mealPlan: Record<DayId, string | null>;
  checkedItemIds: string[];
  postponedItemDays: Record<string, BuyOnDay>;
  manualItems: ManualItem[];
  copiedFromWeekId?: string;
}

export interface PrototypeState {
  activeTab: PrototypeTab;
  selectedStoreId: string;
  selectedWeekId: string;
  shoppingFilter: ShoppingFilter;
  weeks: MealPlanWeek[];
  storeOrders: Record<string, IngredientCategory[]>;
}

export const stores: Store[] = [
  {
    id: "rema",
    name: "Rema 1000",
    sectionOrder: [
      "Frukt og grønt",
      "Bakst og brød",
      "Kjøtt og fisk",
      "Meieri",
      "Torrvarer",
      "Frys",
      "Drikke",
      "Husholdning",
      "Annet",
    ],
  },
  {
    id: "coop",
    name: "Coop Mega",
    sectionOrder: [
      "Frukt og grønt",
      "Kjøtt og fisk",
      "Meieri",
      "Bakst og brød",
      "Torrvarer",
      "Frys",
      "Drikke",
      "Husholdning",
      "Annet",
    ],
  },
  {
    id: "meny",
    name: "Meny",
    sectionOrder: [
      "Frukt og grønt",
      "Kjøtt og fisk",
      "Bakst og brød",
      "Meieri",
      "Torrvarer",
      "Drikke",
      "Frys",
      "Husholdning",
      "Annet",
    ],
  },
];

export const recipes: Recipe[] = [
  {
    id: "kylling-taco",
    title: "Kyllingtaco",
    description: "Rask middagsfavoritt med mye smak og enkel topping.",
    prepMinutes: 25,
    servings: 4,
    tags: ["rask", "barnevennlig", "fredag"],
    ingredients: [
      { id: "chicken", name: "Kyllingfilet", amount: "600 g", category: "Kjøtt og fisk" },
      { id: "tortillas", name: "Tortillalefser", amount: "2 pk", category: "Bakst og brød" },
      { id: "corn", name: "Mais", amount: "1 boks", category: "Torrvarer" },
      { id: "lettuce", name: "Hjertesalat", amount: "2 stk", category: "Frukt og grønt" },
      { id: "tomato", name: "Tomater", amount: "4 stk", category: "Frukt og grønt" },
      { id: "creme", name: "Lettrømme", amount: "1 beger", category: "Meieri" },
      { id: "cheese", name: "Revet ost", amount: "250 g", category: "Meieri" },
    ],
  },
  {
    id: "tomatsuppe",
    title: "Tomatsuppe med egg",
    description: "Enkel hverdagsmiddag som passer fint på travle dager.",
    prepMinutes: 20,
    servings: 4,
    tags: ["rask", "rimelig", "vegetar"],
    ingredients: [
      { id: "soup", name: "Tomatsuppe", amount: "2 poser", category: "Torrvarer" },
      { id: "macaroni", name: "Makaroni", amount: "250 g", category: "Torrvarer" },
      { id: "eggs", name: "Egg", amount: "6 stk", category: "Meieri" },
      { id: "bread", name: "Grovt brød", amount: "1 stk", category: "Bakst og brød" },
    ],
  },
  {
    id: "pasta-kjottsaus",
    title: "Pasta med kjøttsaus",
    description: "Klassiker som gir gode rester til lunsj dagen etter.",
    prepMinutes: 35,
    servings: 4,
    tags: ["familie", "restevennlig"],
    ingredients: [
      { id: "mince", name: "Karbonadedeig", amount: "400 g", category: "Kjøtt og fisk" },
      { id: "onion", name: "Gul løk", amount: "1 stk", category: "Frukt og grønt" },
      { id: "garlic", name: "Hvitløk", amount: "2 fedd", category: "Frukt og grønt" },
      { id: "passata", name: "Passata", amount: "2 flasker", category: "Torrvarer" },
      { id: "spaghetti", name: "Spaghetti", amount: "500 g", category: "Torrvarer" },
      { id: "parmesan", name: "Parmesan", amount: "1 bit", category: "Meieri", preferredStoreId: "meny" },
    ],
  },
  {
    id: "chili-sin-carne",
    title: "Chili sin carne",
    description: "Billig og mettende vegetarrett som er lett å lage mye av.",
    prepMinutes: 30,
    servings: 4,
    tags: ["vegetar", "frysevennlig", "rimelig"],
    ingredients: [
      { id: "beans", name: "Kidneybonner", amount: "2 bokser", category: "Torrvarer" },
      { id: "tomatoes", name: "Hakkede tomater", amount: "2 bokser", category: "Torrvarer" },
      { id: "pepper", name: "Paprika", amount: "2 stk", category: "Frukt og grønt" },
      { id: "rice", name: "Basmatiris", amount: "400 g", category: "Torrvarer" },
      { id: "avocado", name: "Avokado", amount: "2 stk", category: "Frukt og grønt" },
      { id: "yoghurt", name: "Gresk yoghurt", amount: "1 beger", category: "Meieri" },
    ],
  },
  {
    id: "laksewraps",
    title: "Laksewraps",
    description: "Frisk middag med laks, agurk og urter. Fin til helg eller rask ukedag.",
    prepMinutes: 25,
    servings: 4,
    tags: ["rask", "fisk", "helg"],
    ingredients: [
      { id: "salmon", name: "Laksefilet", amount: "600 g", category: "Kjøtt og fisk" },
      { id: "wraps", name: "Wraps", amount: "1 pk", category: "Bakst og brød" },
      { id: "cucumber", name: "Agurk", amount: "1 stk", category: "Frukt og grønt" },
      { id: "mango", name: "Mango", amount: "1 stk", category: "Frukt og grønt", preferredStoreId: "meny" },
      { id: "cream-cheese", name: "Kremost", amount: "1 beger", category: "Meieri" },
    ],
  },
  {
    id: "ovnsbakt-laks",
    title: "Ovnsbakt laks med poteter",
    description: "Lett helgemiddag med få komponenter og lite oppvask.",
    prepMinutes: 35,
    servings: 4,
    tags: ["fisk", "helg", "enkel"],
    ingredients: [
      { id: "salmon-portions", name: "Lakseporsjoner", amount: "4 stk", category: "Kjøtt og fisk" },
      { id: "potatoes", name: "Småpoteter", amount: "1 pose", category: "Frukt og grønt" },
      { id: "broccoli", name: "Brokkoli", amount: "2 stk", category: "Frukt og grønt" },
      { id: "creme-fraiche", name: "Creme fraiche", amount: "1 beger", category: "Meieri" },
    ],
  },
  {
    id: "kyllinggryte",
    title: "Kremet kyllinggryte",
    description: "God søndagsmiddag som også fungerer som restemat mandag.",
    prepMinutes: 40,
    servings: 4,
    tags: ["familie", "helg", "restevennlig"],
    ingredients: [
      { id: "chicken-thigh", name: "Kyllinglar", amount: "800 g", category: "Kjøtt og fisk" },
      { id: "carrots", name: "Gulrot", amount: "4 stk", category: "Frukt og grønt" },
      { id: "mushrooms", name: "Sjampinjong", amount: "250 g", category: "Frukt og grønt" },
      { id: "cream", name: "Matfløte", amount: "3 dl", category: "Meieri" },
      { id: "bouillon", name: "Kyllingbuljong", amount: "1 pk", category: "Torrvarer" },
      { id: "mashed", name: "Potetmos", amount: "1 pk", category: "Torrvarer" },
    ],
  },
];

export function createEmptyMealPlan(): Record<DayId, string | null> {
  return Object.fromEntries(weekDays.map((dayId) => [dayId, null])) as Record<DayId, string | null>;
}

export function createWeek(params: {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  shoppingDay?: DayId;
  planApproved?: boolean;
  mealPlan?: Partial<Record<DayId, string | null>>;
  checkedItemIds?: string[];
  postponedItemDays?: Record<string, BuyOnDay>;
  manualItems?: ManualItem[];
  copiedFromWeekId?: string;
}): MealPlanWeek {
  let startDate = isLocalDateString(params.startDate)
    ? params.startDate
    : formatLocalDate(startOfWeek(new Date()));
  let endDate = normalizeEndDate(startDate, params.endDate);
  let visibleDays = getVisibleDaysForRange(startDate, endDate);
  let normalizedShoppingDay = normalizeShoppingDay(params.shoppingDay, visibleDays);

  return {
    id: params.id,
    title: params.title,
    startDate,
    endDate,
    shoppingDay: normalizedShoppingDay,
    planApproved: params.planApproved ?? false,
    mealPlan: {
      ...createEmptyMealPlan(),
      ...(params.mealPlan ?? {}),
    },
    checkedItemIds: params.checkedItemIds ?? [],
    postponedItemDays: params.postponedItemDays ?? {},
    manualItems: params.manualItems ?? [],
    copiedFromWeekId: params.copiedFromWeekId,
  };
}

export function createBlankWeek(
  title: string,
  startDate: string = formatLocalDate(startOfWeek(new Date())),
  endDate: string = formatLocalDate(addDays(parseLocalDate(startDate), 6)),
): MealPlanWeek {
  return createWeek({
    id: createWeekId(),
    title,
    startDate,
    endDate,
    shoppingDay: getVisibleDaysForRange(startDate, normalizeEndDate(startDate, endDate))[0],
  });
}

export function cloneWeek(
  sourceWeek: MealPlanWeek,
  title: string,
  startDate: string = formatLocalDate(addDays(parseLocalDate(sourceWeek.startDate), 7)),
  endDate: string = formatLocalDate(
    addDays(parseLocalDate(startDate), differenceInDays(sourceWeek.startDate, sourceWeek.endDate)),
  ),
): MealPlanWeek {
  return createWeek({
    id: createWeekId(),
    title,
    startDate,
    endDate,
    shoppingDay: "mandag",
    mealPlan: sourceWeek.mealPlan,
    manualItems: sourceWeek.manualItems.map((item) => ({
      ...item,
      id: `${item.id}-copy-${Math.random().toString(36).slice(2, 8)}`,
    })),
    copiedFromWeekId: sourceWeek.id,
  });
}

export function createDefaultPrototypeState(): PrototypeState {
  let currentWeekMonday = startOfWeek(new Date());
  let currentWeekThursday = addDays(currentWeekMonday, 3);
  let currentWeekSunday = addDays(currentWeekMonday, 6);
  let nextWeekStart = addDays(currentWeekMonday, 7);
  let nextWeekEnd = addDays(nextWeekStart, 6);

  let activeWeek = createWeek({
    id: "uke-aktiv",
    title: "Aktiv uke",
    startDate: formatLocalDate(currentWeekThursday),
    endDate: formatLocalDate(currentWeekSunday),
    shoppingDay: "torsdag",
    mealPlan: {
      torsdag: "chili-sin-carne",
      fredag: "kylling-taco",
      lordag: "ovnsbakt-laks",
      sondag: "kyllinggryte",
    },
    manualItems: [
      {
        id: "manual-toalettpapir",
        name: "Toalettpapir",
        quantity: "1 stor pakke",
        category: "Husholdning",
        buyOnDay: "now",
      },
      {
        id: "manual-jordbar",
        name: "Jordbær til helg",
        quantity: "2 bokser",
        category: "Frukt og grønt",
        buyOnDay: "fredag",
        preferredStoreId: "meny",
        note: "Ekstra til dessert på lørdag",
      },
    ],
  });

  let nextWeek = createWeek({
    id: "uke-neste",
    title: "Neste uke",
    startDate: formatLocalDate(nextWeekStart),
    endDate: formatLocalDate(nextWeekEnd),
    shoppingDay: "mandag",
    mealPlan: {
      mandag: "tomatsuppe",
      tirsdag: "pasta-kjottsaus",
      onsdag: "chili-sin-carne",
      torsdag: "laksewraps",
      fredag: "kylling-taco",
      lordag: "ovnsbakt-laks",
      sondag: "kyllinggryte",
    },
  });

  return {
    activeTab: "plan",
    selectedStoreId: stores[0].id,
    selectedWeekId: activeWeek.id,
    shoppingFilter: "today",
    weeks: [activeWeek, nextWeek],
    storeOrders: Object.fromEntries(stores.map((store) => [store.id, [...store.sectionOrder]])),
  };
}

export function mergePrototypeState(input: unknown): PrototypeState {
  let base = createDefaultPrototypeState();

  if (!input || typeof input !== "object") {
    return base;
  }

  let value = input as Partial<PrototypeState>;
  let weeks = Array.isArray(value.weeks)
    ? value.weeks.map(sanitizeWeek).filter((week): week is MealPlanWeek => week !== null)
    : base.weeks;

  if (weeks.length === 0) {
    weeks = base.weeks;
  }

  let selectedWeekId =
    typeof value.selectedWeekId === "string" && weeks.some((week) => week.id === value.selectedWeekId)
      ? value.selectedWeekId
      : weeks[0].id;

  return {
    activeTab: isPrototypeTab(value.activeTab) ? value.activeTab : base.activeTab,
    selectedStoreId:
      typeof value.selectedStoreId === "string" && getStoreById(value.selectedStoreId)
        ? value.selectedStoreId
        : base.selectedStoreId,
    selectedWeekId,
    shoppingFilter: isShoppingFilter(value.shoppingFilter) ? value.shoppingFilter : base.shoppingFilter,
    weeks,
    storeOrders: {
      ...base.storeOrders,
      ...sanitizeStoreOrders(value.storeOrders),
    },
  };
}

export function buildShoppingItems(week: MealPlanWeek): ShoppingItem[] {
  let items: ShoppingItem[] = [];

  for (let dayId of getVisibleDays(week)) {
    let recipeId = week.mealPlan[dayId];
    let recipe = getRecipeById(recipeId);
    if (!recipe) continue;

    for (let ingredient of recipe.ingredients) {
      let itemId = `${week.id}:${dayId}:${recipe.id}:${ingredient.id}`;
      items.push({
        id: itemId,
        name: ingredient.name,
        quantity: ingredient.amount,
        category: ingredient.category,
        source: "recipe",
        dayId,
        recipeId: recipe.id,
        recipeName: recipe.title,
        preferredStoreId: ingredient.preferredStoreId,
        buyOnDay: week.postponedItemDays[itemId] ?? "now",
      });
    }
  }

  for (let item of week.manualItems) {
    let itemId = `${week.id}:manual:${item.id}`;
    items.push({
      id: itemId,
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      source: "manual",
      preferredStoreId: item.preferredStoreId,
      buyOnDay: week.postponedItemDays[itemId] ?? item.buyOnDay,
      note: item.note,
    });
  }

  return items;
}

export function getRecipeById(recipeId: string | null | undefined) {
  if (!recipeId) return null;
  return recipes.find((recipe) => recipe.id === recipeId) ?? null;
}

export function getStoreById(storeId: string | null | undefined) {
  if (!storeId) return null;
  return stores.find((store) => store.id === storeId) ?? null;
}

export function getStoreOrder(state: PrototypeState, storeId: string): IngredientCategory[] {
  return state.storeOrders[storeId] ?? ingredientCategories;
}

export function getWeekById(state: PrototypeState, weekId: string | null | undefined) {
  if (!weekId) return null;
  return state.weeks.find((week) => week.id === weekId) ?? null;
}

export function getDayLabel(dayId: DayId): string {
  if (dayId === "lordag") {
    return "lørdag";
  }

  if (dayId === "sondag") {
    return "søndag";
  }

  return dayId;
}

export function getVisibleDays(week: MealPlanWeek): DayId[] {
  return getVisibleDaysForRange(week.startDate, week.endDate);
}

export function getWeekWindowLabel(week: MealPlanWeek): string {
  let visibleDays = getVisibleDays(week);
  let firstDay = visibleDays[0];
  let lastDay = visibleDays[visibleDays.length - 1];

  return `${getDayLabel(firstDay)}-${getDayLabel(lastDay)}`;
}

export function getDateForWeekDay(week: MealPlanWeek, dayId: DayId): string {
  let current = parseLocalDate(week.startDate);
  let last = parseLocalDate(week.endDate);

  while (current <= last) {
    if (getDayIdForDate(current) === dayId) {
      return formatLocalDate(current);
    }

    current = addDays(current, 1);
  }

  return week.startDate;
}

export function getShoppingProgress(week: MealPlanWeek, items: ShoppingItem[]) {
  let itemIdSet = new Set(items.map((item) => item.id));
  let checkedCount = week.checkedItemIds.filter((itemId) => itemIdSet.has(itemId)).length;

  return {
    checkedCount,
    totalCount: items.length,
  };
}

export function getPlannedMealCount(week: MealPlanWeek) {
  return getVisibleDays(week).reduce((count, dayId) => count + (week.mealPlan[dayId] ? 1 : 0), 0);
}

export function getItemsDueToday(items: ShoppingItem[], shoppingDay: DayId) {
  return items.filter((item) => isItemDue(item.buyOnDay, shoppingDay));
}

export function getItemsLater(items: ShoppingItem[], shoppingDay: DayId) {
  return items.filter((item) => !isItemDue(item.buyOnDay, shoppingDay));
}

export function isItemDue(buyOnDay: BuyOnDay, shoppingDay: DayId) {
  if (buyOnDay === "now") return true;
  return weekDays.indexOf(buyOnDay) <= weekDays.indexOf(shoppingDay);
}

export function moveCategoryOrder(
  order: IngredientCategory[],
  category: IngredientCategory,
  direction: "up" | "down",
) {
  let nextOrder = [...order];
  let currentIndex = nextOrder.indexOf(category);

  if (currentIndex === -1) {
    return nextOrder;
  }

  let targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= nextOrder.length) {
    return nextOrder;
  }

  [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
  return nextOrder;
}

function sanitizeWeek(value: unknown): MealPlanWeek | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  let week = value as Partial<MealPlanWeek>;
  if (typeof week.id !== "string" || typeof week.title !== "string") {
    return null;
  }

  let startDate = isLocalDateString(week.startDate) ? week.startDate : formatLocalDate(startOfWeek(new Date()));
  let endDate = normalizeEndDate(startDate, week.endDate);
  let shoppingDay = normalizeShoppingDay(week.shoppingDay, getVisibleDaysForRange(startDate, endDate));

  return createWeek({
    id: week.id,
    title: week.title,
    startDate,
    endDate,
    shoppingDay,
    planApproved: typeof week.planApproved === "boolean" ? week.planApproved : false,
    mealPlan: typeof week.mealPlan === "object" ? week.mealPlan : undefined,
    checkedItemIds: Array.isArray(week.checkedItemIds)
      ? week.checkedItemIds.filter((item): item is string => typeof item === "string")
      : undefined,
    postponedItemDays: sanitizePostponedItemDays(week.postponedItemDays),
    manualItems: Array.isArray(week.manualItems)
      ? week.manualItems
          .filter(isManualItemLike)
          .map((item) => ({
            ...item,
            category: coerceIngredientCategory(item.category)!,
          }))
      : undefined,
    copiedFromWeekId: typeof week.copiedFromWeekId === "string" ? week.copiedFromWeekId : undefined,
  });
}

function sanitizePostponedItemDays(input: unknown): Record<string, BuyOnDay> {
  if (!input || typeof input !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, BuyOnDay] => {
      return typeof entry[0] === "string" && isBuyOnDay(entry[1]);
    }),
  );
}

function sanitizeStoreOrders(input: unknown): Record<string, IngredientCategory[]> {
  if (!input || typeof input !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).flatMap(([storeId, order]) => {
      if (!Array.isArray(order)) {
        return [];
      }

      let filteredOrder = order
        .map((item) => (typeof item === "string" ? coerceIngredientCategory(item) : null))
        .filter((item): item is IngredientCategory => item !== null);

      if (filteredOrder.length === 0) {
        return [];
      }

      let uniqueOrder = filteredOrder.filter((item, index) => filteredOrder.indexOf(item) === index);
      let missing = ingredientCategories.filter((item) => !uniqueOrder.includes(item));

      return [[storeId, [...uniqueOrder, ...missing]]];
    }),
  );
}

function isManualItemLike(value: unknown): value is ManualItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  let item = value as Partial<ManualItem>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.quantity === "string" &&
    coerceIngredientCategory(item.category) !== null &&
    isBuyOnDay(item.buyOnDay)
  );
}

function isDayId(value: unknown): value is DayId {
  return typeof value === "string" && weekDays.includes(value as DayId);
}

function isBuyOnDay(value: unknown): value is BuyOnDay {
  return value === "now" || isDayId(value);
}

function isLocalDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeShoppingDay(value: unknown, visibleDays: DayId[]): DayId {
  if (visibleDays.length === 0) {
    return "mandag";
  }

  let day = isDayId(value) ? value : visibleDays[0];
  return visibleDays.includes(day) ? day : visibleDays[0];
}

function isPrototypeTab(value: unknown): value is PrototypeTab {
  return value === "plan" || value === "liste" || value === "butikk" || value === "butikker";
}

function isShoppingFilter(value: unknown): value is ShoppingFilter {
  return value === "today" || value === "later" || value === "all";
}

function createWeekId() {
  return `uke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEndDate(startDate: string, endDate: unknown) {
  if (!isLocalDateString(endDate)) {
    return formatLocalDate(addDays(parseLocalDate(startDate), 6));
  }

  let start = parseLocalDate(startDate);
  let end = parseLocalDate(endDate);
  let max = addDays(start, 6);

  if (end < start) {
    return startDate;
  }

  if (end > max) {
    return formatLocalDate(max);
  }

  return endDate;
}

function getVisibleDaysForRange(startDate: string, endDate: string): DayId[] {
  let days: DayId[] = [];
  let current = parseLocalDate(startDate);
  let last = parseLocalDate(endDate);

  while (current <= last) {
    days.push(getDayIdForDate(current));
    current = addDays(current, 1);
  }

  return days;
}

function getDayIdForDate(date: Date): DayId {
  let day = date.getDay();
  if (day === 0) return "sondag";
  return weekDays[day - 1];
}

function differenceInDays(startDate: string, endDate: string) {
  let start = parseLocalDate(startDate).getTime();
  let end = parseLocalDate(endDate).getTime();
  let millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((end - start) / millisecondsPerDay));
}

function startOfWeek(date: Date) {
  let normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let day = normalized.getDay();
  let delta = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + delta);
  return normalized;
}

function addDays(date: Date, amount: number) {
  let result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}

function parseLocalDate(value: string) {
  let [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date) {
  let year = date.getFullYear();
  let month = `${date.getMonth() + 1}`.padStart(2, "0");
  let day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
