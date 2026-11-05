import { db } from "./db.server";
import {
  buildShoppingNotePrompt,
  normalizeShoppingNoteText,
  parseShoppingNoteModelJson,
  shoppingNoteMessages,
  validateShoppingNoteLength,
  type ShoppingNoteCategory,
} from "./shopping-note";

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_TIMEOUT_MS = 20_000;

export async function listShoppingNoteCategories() {
  return db.ingredientCategory.findMany({
    orderBy: [{ displayName: "asc" }],
    select: {
      displayName: true,
      id: true,
    },
  });
}

export async function interpretShoppingNote({
  categories,
  note,
}: {
  categories: ShoppingNoteCategory[];
  note: string;
}) {
  const lengthError = validateShoppingNoteLength(note);

  if (lengthError) {
    return { error: lengthError, ok: false as const };
  }

  if (categories.length === 0) {
    return { error: shoppingNoteMessages.noCategories, ok: false as const };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { error: shoppingNoteMessages.geminiMissing, ok: false as const };
  }

  const text = normalizeShoppingNoteText(note);
  const prompt = buildShoppingNotePrompt({
    categories,
    note: text,
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: buildShoppingNoteResponseSchema(
              categories.map((category) => category.id),
            ),
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      console.error("Gemini shopping note error:", response.status);
      return { error: shoppingNoteMessages.geminiFailed, ok: false as const };
    }

    const candidateText = readCandidateText(await response.json());

    if (!candidateText) {
      return { error: shoppingNoteMessages.emptyResponse, ok: false as const };
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(candidateText);
    } catch {
      return { error: shoppingNoteMessages.badJson, ok: false as const };
    }

    return parseShoppingNoteModelJson(
      parsed,
      new Set(categories.map((category) => category.id)),
    );
  } catch (error) {
    console.error(
      "Gemini shopping note request failed:",
      error instanceof Error ? error.name : "Error",
    );
    return { error: shoppingNoteMessages.geminiFailed, ok: false as const };
  }
}

function buildShoppingNoteResponseSchema(categoryIds: string[]) {
  return {
    properties: {
      items: {
        items: {
          properties: {
            categoryId: { enum: categoryIds, type: "STRING" },
            name: { type: "STRING" },
            quantity: { nullable: true, type: "STRING" },
          },
          required: ["name", "categoryId"],
          type: "OBJECT",
        },
        type: "ARRAY",
      },
    },
    required: ["items"],
    type: "OBJECT",
  };
}

function readCandidateText(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidates = (value as { candidates?: unknown }).candidates;

  if (!Array.isArray(candidates)) {
    return null;
  }

  const content = (candidates[0] as { content?: unknown } | undefined)?.content;

  if (!content || typeof content !== "object") {
    return null;
  }

  const parts = (content as { parts?: unknown }).parts;

  if (!Array.isArray(parts)) {
    return null;
  }

  const text = (parts[0] as { text?: unknown } | undefined)?.text;
  return typeof text === "string" && text.trim() ? text : null;
}
