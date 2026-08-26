export const RECIPE_REMINDER_SHORTCUT_NAME = "Create Recipe Reminder";

export interface RecipeReminderSuggestion {
  id?: string;
  title: string;
}

export interface RecipeReminderInput {
  dueAt: Date;
  recipeUrl: string;
  suggestionId?: string;
  title: string;
}

export interface RecipeReminderPayload {
  dueDate: string;
  dueISO: string;
  dueTime: string;
  notes: string;
  suggestionId?: string;
  title: string;
  url: string;
}

export type CreateRecipeReminderError =
  | "EMPTY_TITLE"
  | "INVALID_DATE"
  | "INVALID_URL";

export type CreateRecipeReminderResult =
  | { ok: true; payload: RecipeReminderPayload; url: string }
  | { error: CreateRecipeReminderError; ok: false };

export type RecipeReminderPlatformSupport = "ios" | "macos" | "unsupported";

export type RecipeReminderPresetId =
  | "custom"
  | "tomorrow-afternoon"
  | "tomorrow-evening"
  | "tomorrow-morning";

export interface RecipeReminderPreset {
  dayOffset?: number;
  hour?: number;
  id: RecipeReminderPresetId;
  label: string;
  minute?: number;
}

export const RECIPE_REMINDER_PRESETS: readonly RecipeReminderPreset[] = [
  {
    dayOffset: 1,
    hour: 8,
    id: "tomorrow-morning",
    label: "I morgen tidlig",
    minute: 0,
  },
  {
    dayOffset: 1,
    hour: 15,
    id: "tomorrow-afternoon",
    label: "I morgen ettermiddag",
    minute: 0,
  },
  {
    dayOffset: 1,
    hour: 18,
    id: "tomorrow-evening",
    label: "I morgen kveld",
    minute: 0,
  },
  {
    id: "custom",
    label: "Velg tid selv",
  },
];

export function buildFamilyRecipeUrl({
  familyId,
  origin,
  recipeId,
}: {
  familyId: string;
  origin: string;
  recipeId: string;
}) {
  const base = origin.replace(/\/+$/, "");

  return `${base}/families/${encodeURIComponent(familyId)}/recipes/${encodeURIComponent(recipeId)}`;
}

export function getRecipeReminderPlatformSupport(input: {
  maxTouchPoints?: number;
  platform?: string;
  userAgent: string;
}): RecipeReminderPlatformSupport {
  if (/iPad|iPhone|iPod/i.test(input.userAgent)) {
    return "ios";
  }

  if (input.platform === "MacIntel" && (input.maxTouchPoints ?? 0) > 1) {
    return "ios";
  }

  if (/Macintosh|Mac OS X/i.test(input.userAgent)) {
    return "macos";
  }

  return "unsupported";
}

export function canLaunchRecipeReminderShortcut(
  support: RecipeReminderPlatformSupport,
) {
  return support === "ios" || support === "macos";
}

export function formatLocalDateInput(date: Date) {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
}

export function formatLocalTimeInput(date: Date) {
  return [
    date.getHours().toString().padStart(2, "0"),
    date.getMinutes().toString().padStart(2, "0"),
  ].join(":");
}

export function parseLocalDateTime(date: string, time: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const result = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );

  if (Number.isNaN(result.getTime())) {
    return null;
  }

  return result;
}

export function applyRecipeReminderPreset(
  presetId: Exclude<RecipeReminderPresetId, "custom">,
  now: Date,
) {
  const preset = RECIPE_REMINDER_PRESETS.find((item) => item.id === presetId);

  if (!preset || preset.dayOffset == null || preset.hour == null || preset.minute == null) {
    throw new Error(`Unknown reminder preset: ${presetId}`);
  }

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + preset.dayOffset,
    preset.hour,
    preset.minute,
    0,
    0,
  );
}

export function buildRecipeReminderPayload(
  input: RecipeReminderInput,
): RecipeReminderPayload | CreateRecipeReminderError {
  const title = input.title.trim();

  if (!title) {
    return "EMPTY_TITLE";
  }

  if (Number.isNaN(input.dueAt.getTime())) {
    return "INVALID_DATE";
  }

  if (!isHttpUrl(input.recipeUrl)) {
    return "INVALID_URL";
  }

  const dueDate = formatLocalDateInput(input.dueAt);
  const dueTime = formatLocalTimeInput(input.dueAt);
  const payload: RecipeReminderPayload = {
    dueDate,
    dueISO: `${dueDate}T${dueTime}:00`,
    dueTime,
    notes: input.recipeUrl,
    title,
    url: input.recipeUrl,
  };

  if (input.suggestionId) {
    payload.suggestionId = input.suggestionId;
  }

  return payload;
}

export function buildRecipeReminderShortcutUrl(payload: RecipeReminderPayload) {
  const text = JSON.stringify(payload);

  return `shortcuts://run-shortcut?name=${encodeURIComponent(RECIPE_REMINDER_SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(text)}`;
}

export function parseRecipeReminderShortcutUrl(url: string) {
  if (!url.startsWith("shortcuts://run-shortcut?")) {
    return null;
  }

  const query = url.slice("shortcuts://run-shortcut?".length);
  const params = new URLSearchParams(query);
  const name = params.get("name");
  const input = params.get("input");
  const text = params.get("text");

  if (name !== RECIPE_REMINDER_SHORTCUT_NAME || input !== "text" || !text) {
    return null;
  }

  try {
    return JSON.parse(text) as RecipeReminderPayload;
  } catch {
    return null;
  }
}

export function createRecipeReminder(
  input: RecipeReminderInput,
  options?: { openUrl?: (url: string) => void },
): CreateRecipeReminderResult {
  const payload = buildRecipeReminderPayload(input);

  if (typeof payload === "string") {
    return { error: payload, ok: false };
  }

  const url = buildRecipeReminderShortcutUrl(payload);
  const openUrl = options?.openUrl ?? openShortcutUrl;
  openUrl(url);

  return { ok: true, payload, url };
}

export function openShortcutUrl(url: string) {
  window.location.assign(url);
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
