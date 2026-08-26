import { describe, expect, it, vi } from "vitest";

import {
  applyRecipeReminderPreset,
  buildFamilyRecipeUrl,
  buildRecipeReminderPayload,
  buildRecipeReminderShortcutUrl,
  canLaunchRecipeReminderShortcut,
  createRecipeReminder,
  formatLocalDateInput,
  formatLocalTimeInput,
  getRecipeReminderPlatformSupport,
  parseLocalDateTime,
  parseRecipeReminderShortcutUrl,
  RECIPE_REMINDER_SHORTCUT_NAME,
} from "./recipe-reminder";

const recipeUrl = "https://mealplanner.example/families/family-1/recipes/recipe-1";

describe("recipe-reminder", () => {
  it("builds a family recipe URL from origin and ids", () => {
    expect(
      buildFamilyRecipeUrl({
        familyId: "family-1",
        origin: "https://mealplanner.example/",
        recipeId: "recipe-1",
      }),
    ).toBe(recipeUrl);
  });

  it("encodes spaces as %20 in the shortcut name, not as plus", () => {
    const payload = buildRecipeReminderPayload({
      dueAt: new Date(2026, 7, 27, 8, 0, 0),
      recipeUrl,
      title: "Pizza",
    });

    expect(payload).not.toBeTypeOf("string");
    if (typeof payload === "string") {
      return;
    }

    const url = buildRecipeReminderShortcutUrl(payload);

    expect(url).toContain("name=Create%20Recipe%20Reminder");
    expect(url).not.toContain("name=Create+Recipe+Reminder");
    expect(url.startsWith("shortcuts://run-shortcut?")).toBe(true);
    expect(url).toContain("input=text");
  });

  it("round-trips titles with Norwegian characters, ampersands, quotes, and emoji", () => {
    const title = 'Ta deigen ut av kjøleskapet & "start" 🍕';
    const payload = buildRecipeReminderPayload({
      dueAt: new Date(2026, 7, 27, 8, 0, 0),
      recipeUrl,
      title,
    });

    expect(payload).not.toBeTypeOf("string");
    if (typeof payload === "string") {
      return;
    }

    const parsed = parseRecipeReminderShortcutUrl(
      buildRecipeReminderShortcutUrl(payload),
    );

    expect(parsed?.title).toBe(title);
    expect(parsed?.url).toBe(recipeUrl);
  });

  it("preserves recipe URLs that already contain query parameters", () => {
    const urlWithQuery =
      "https://mealplanner.example/families/family-1/recipes/recipe-1?ref=plan&day=2026-08-27";
    const payload = buildRecipeReminderPayload({
      dueAt: new Date(2026, 7, 27, 8, 0, 0),
      recipeUrl: urlWithQuery,
      title: "Pizza",
    });

    expect(payload).not.toBeTypeOf("string");
    if (typeof payload === "string") {
      return;
    }

    const parsed = parseRecipeReminderShortcutUrl(
      buildRecipeReminderShortcutUrl(payload),
    );

    expect(parsed?.url).toBe(urlWithQuery);
    expect(parsed?.notes).toBe(urlWithQuery);
    expect(parsed?.dueISO).toBe("2026-08-27T08:00:00");
    expect(parsed?.dueISO.endsWith("Z")).toBe(false);
  });

  it("includes suggestionId when a saved suggestion is used", () => {
    const payload = buildRecipeReminderPayload({
      dueAt: new Date(2026, 7, 27, 8, 0, 0),
      recipeUrl,
      suggestionId: "suggestion-dough",
      title: "Ta deigen ut av kjøleskapet",
    });

    expect(payload).not.toBeTypeOf("string");
    if (typeof payload === "string") {
      return;
    }

    expect(payload.suggestionId).toBe("suggestion-dough");
    expect(
      parseRecipeReminderShortcutUrl(buildRecipeReminderShortcutUrl(payload))
        ?.suggestionId,
    ).toBe("suggestion-dough");
  });

  it("rejects empty titles, invalid dates, and non-http URLs", () => {
    expect(
      buildRecipeReminderPayload({
        dueAt: new Date(2026, 7, 27, 8, 0, 0),
        recipeUrl,
        title: "   ",
      }),
    ).toBe("EMPTY_TITLE");
    expect(
      buildRecipeReminderPayload({
        dueAt: new Date("invalid"),
        recipeUrl,
        title: "Pizza",
      }),
    ).toBe("INVALID_DATE");
    expect(
      buildRecipeReminderPayload({
        dueAt: new Date(2026, 7, 27, 8, 0, 0),
        recipeUrl: "shortcuts://not-a-recipe",
        title: "Pizza",
      }),
    ).toBe("INVALID_URL");
  });

  it("creates a reminder by constructing the URL then launching it", () => {
    const openUrl = vi.fn();
    const result = createRecipeReminder(
      {
        dueAt: new Date(2026, 7, 27, 8, 0, 0),
        recipeUrl,
        title: "Lag pizzadeig",
      },
      { openUrl },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl).toHaveBeenCalledWith(result.url);
    expect(parseRecipeReminderShortcutUrl(result.url)?.title).toBe(
      "Lag pizzadeig",
    );
    expect(RECIPE_REMINDER_SHORTCUT_NAME).toBe("Create Recipe Reminder");
  });

  it("does not launch when validation fails", () => {
    const openUrl = vi.fn();
    const result = createRecipeReminder(
      {
        dueAt: new Date(2026, 7, 27, 8, 0, 0),
        recipeUrl,
        title: "",
      },
      { openUrl },
    );

    expect(result).toEqual({ error: "EMPTY_TITLE", ok: false });
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("applies tomorrow-morning in local time", () => {
    const now = new Date(2026, 7, 26, 14, 30, 0);
    const dueAt = applyRecipeReminderPreset("tomorrow-morning", now);

    expect(formatLocalDateInput(dueAt)).toBe("2026-08-27");
    expect(formatLocalTimeInput(dueAt)).toBe("08:00");
  });

  it("parses local date and time fields without using UTC", () => {
    const dueAt = parseLocalDateTime("2026-08-27", "08:00");

    expect(dueAt).not.toBeNull();
    expect(dueAt?.getFullYear()).toBe(2026);
    expect(dueAt?.getMonth()).toBe(7);
    expect(dueAt?.getDate()).toBe(27);
    expect(dueAt?.getHours()).toBe(8);
    expect(dueAt?.getMinutes()).toBe(0);
    expect(parseLocalDateTime("27.08.2026", "8:00")).toBeNull();
  });

  it("detects iOS, iPadOS, macOS, and unsupported platforms", () => {
    expect(
      getRecipeReminderPlatformSupport({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      }),
    ).toBe("ios");
    expect(
      getRecipeReminderPlatformSupport({
        maxTouchPoints: 5,
        platform: "MacIntel",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      }),
    ).toBe("ios");
    expect(
      getRecipeReminderPlatformSupport({
        maxTouchPoints: 0,
        platform: "MacIntel",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      }),
    ).toBe("macos");
    expect(
      getRecipeReminderPlatformSupport({
        userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
      }),
    ).toBe("unsupported");
    expect(canLaunchRecipeReminderShortcut("ios")).toBe(true);
    expect(canLaunchRecipeReminderShortcut("macos")).toBe(true);
    expect(canLaunchRecipeReminderShortcut("unsupported")).toBe(false);
  });
});
