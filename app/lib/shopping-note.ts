import { z } from "zod";

export const SHOPPING_NOTE_MAX_LENGTH = 2000;
export const SHOPPING_NOTE_MAX_ITEMS = 40;
export const SHOPPING_NOTE_DEFAULT_QUANTITY = "1";

export const shoppingNoteMessages = {
  badJson: "Klarte ikke å lese varene fra notatet.",
  confirmFailed: "Kunne ikke legge til varene fra notatet.",
  empty: "Lim inn et notat først.",
  emptyResponse: "Fikk tomt svar fra AI.",
  geminiFailed: "Kunne ikke tolke notatet. Prøv igjen.",
  geminiMissing: "Gemini API-nøkkel er ikke konfigurert.",
  needCategory: "Velg en kategori på hver vare.",
  needName: "Skriv inn et varenavn på hver vare.",
  needOne: "Legg til minst én vare.",
  noCategories: "Fant ingen kategorier å velge mellom.",
  noCategoryMatch: "Fant ingen kategori for varene.",
  noItems: "Fant ingen varer i notatet.",
  tooLong: `Notatet kan være maks ${SHOPPING_NOTE_MAX_LENGTH} tegn.`,
  tooMany: `Notatet kan gi maks ${SHOPPING_NOTE_MAX_ITEMS} varer.`,
} as const;

export interface ShoppingNoteCategory {
  displayName: string;
  id: string;
}

export interface ParsedShoppingNoteItem {
  categoryId: string | null;
  name: string;
  quantity: string | null;
}

export interface ShoppingNoteReviewItem {
  categoryId: string;
  name: string;
  quantity: string | null;
  resolvedIngredientId: string | null;
  resolvedName: string;
}

export type ShoppingNoteParseResult =
  | { items: ParsedShoppingNoteItem[]; ok: true }
  | { error: string; ok: false };

export type ShoppingNoteReviewParseResult =
  | { items: ShoppingNoteReviewItem[]; ok: true }
  | { error: string; ok: false };

const modelResponseSchema = z.object({
  items: z.array(z.unknown()),
});

const reviewItemsSchema = z.array(z.unknown());

export function normalizeShoppingNoteText(note: string) {
  return note.trim();
}

export function validateShoppingNoteLength(note: string) {
  const text = normalizeShoppingNoteText(note);

  if (!text) {
    return shoppingNoteMessages.empty;
  }

  if (text.length > SHOPPING_NOTE_MAX_LENGTH) {
    return shoppingNoteMessages.tooLong;
  }

  return null;
}

export function parseShoppingNoteModelJson(
  value: unknown,
  allowedCategoryIds: ReadonlySet<string>,
): ShoppingNoteParseResult {
  const parsed = modelResponseSchema.safeParse(value);

  if (!parsed.success) {
    return { error: shoppingNoteMessages.badJson, ok: false };
  }

  if (parsed.data.items.length > SHOPPING_NOTE_MAX_ITEMS) {
    return { error: shoppingNoteMessages.tooMany, ok: false };
  }

  const items: ParsedShoppingNoteItem[] = [];

  for (const entry of parsed.data.items) {
    const item = readModelItem(entry, allowedCategoryIds);

    if (item) {
      items.push(item);
    }
  }

  if (items.length === 0) {
    return { error: shoppingNoteMessages.noItems, ok: false };
  }

  return { items, ok: true };
}

export function pickShoppingNoteCategoryId({
  allowedCategoryIds,
  modelCategoryId,
  resolverCategoryId,
}: {
  allowedCategoryIds: ReadonlySet<string>;
  modelCategoryId: string | null;
  resolverCategoryId: string | null;
}) {
  if (modelCategoryId && allowedCategoryIds.has(modelCategoryId)) {
    return modelCategoryId;
  }

  if (resolverCategoryId && allowedCategoryIds.has(resolverCategoryId)) {
    return resolverCategoryId;
  }

  return null;
}

export function parseShoppingNoteReviewItems(
  value: unknown,
  allowedCategoryIds: ReadonlySet<string>,
): ShoppingNoteReviewParseResult {
  const parsed = reviewItemsSchema.safeParse(value);

  if (!parsed.success || parsed.data.length === 0) {
    return { error: shoppingNoteMessages.needOne, ok: false };
  }

  if (parsed.data.length > SHOPPING_NOTE_MAX_ITEMS) {
    return { error: shoppingNoteMessages.tooMany, ok: false };
  }

  const items: ShoppingNoteReviewItem[] = [];

  for (const entry of parsed.data) {
    const item = readReviewItem(entry);

    if (!item) {
      return { error: shoppingNoteMessages.badJson, ok: false };
    }

    if (!item.name) {
      return { error: shoppingNoteMessages.needName, ok: false };
    }

    if (!item.categoryId || !allowedCategoryIds.has(item.categoryId)) {
      return { error: shoppingNoteMessages.needCategory, ok: false };
    }

    items.push(item);
  }

  return { items, ok: true };
}

export function shoppingNoteQuantityForStorage(quantity: string | null) {
  return quantity?.trim() || SHOPPING_NOTE_DEFAULT_QUANTITY;
}

export function buildShoppingNotePrompt({
  categories,
  note,
}: {
  categories: ShoppingNoteCategory[];
  note: string;
}) {
  const categoryLines = categories
    .map((category) => `- ${category.id}: ${category.displayName}`)
    .join("\n");

  return [
    "Du gjør om et handle-notat til varelinjer. Notatet er på norsk og kan være rotete.",
    "Ta bare med varer som står i notatet. Ikke finn på varer.",
    "Sløyf hilsener, datoer og annen tekst som ikke er en vare.",
    "quantity er mengden slik den står i notatet, eller null hvis notatet ikke oppgir mengde.",
    "categoryId må være en av id-ene under. Ikke finn på kategorier.",
    "Hvis du er usikker, bruk id-en til kategorien som heter Annet.",
    "",
    "Kategorier:",
    categoryLines,
    "",
    "Notat:",
    note,
  ].join("\n");
}

function readModelItem(
  entry: unknown,
  allowedCategoryIds: ReadonlySet<string>,
): ParsedShoppingNoteItem | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as {
    categoryId?: unknown;
    name?: unknown;
    quantity?: unknown;
  };

  if (typeof record.name !== "string") {
    return null;
  }

  const name = record.name.trim();

  if (!name) {
    return null;
  }

  const categoryId =
    typeof record.categoryId === "string" &&
    allowedCategoryIds.has(record.categoryId)
      ? record.categoryId
      : null;

  return {
    categoryId,
    name,
    quantity: readQuantity(record.quantity),
  };
}

function readReviewItem(entry: unknown): ShoppingNoteReviewItem | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as {
    categoryId?: unknown;
    name?: unknown;
    quantity?: unknown;
    resolvedIngredientId?: unknown;
    resolvedName?: unknown;
  };

  if (typeof record.name !== "string" || typeof record.categoryId !== "string") {
    return null;
  }

  if (
    record.resolvedIngredientId !== null &&
    typeof record.resolvedIngredientId !== "string"
  ) {
    return null;
  }

  if (typeof record.resolvedName !== "string") {
    return null;
  }

  if (record.quantity !== null && typeof record.quantity !== "string") {
    return null;
  }

  return {
    categoryId: record.categoryId.trim(),
    name: record.name.trim(),
    quantity: readQuantity(record.quantity),
    resolvedIngredientId: record.resolvedIngredientId?.trim() || null,
    resolvedName: record.resolvedName.trim(),
  };
}

function readQuantity(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const quantity = value.trim();
  return quantity || null;
}
