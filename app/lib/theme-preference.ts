export const THEME_PREFERENCE_VALUES = ["SYSTEM", "LIGHT", "DARK"] as const;

export type ThemePreferenceValue = (typeof THEME_PREFERENCE_VALUES)[number];

export const DEFAULT_THEME_PREFERENCE: ThemePreferenceValue = "SYSTEM";

const htmlClassByPreference = {
  SYSTEM: "system",
  LIGHT: "light",
  DARK: "dark",
} as const;

export type ThemeHtmlClass = (typeof htmlClassByPreference)[ThemePreferenceValue];

const validPreferences = new Set<string>(THEME_PREFERENCE_VALUES);

export function parseThemePreference(
  value: FormDataEntryValue | null | undefined,
): ThemePreferenceValue | null {
  const normalized = String(value ?? "").trim();

  if (validPreferences.has(normalized)) {
    return normalized as ThemePreferenceValue;
  }

  return null;
}

export function resolveThemePreference(
  preference: FormDataEntryValue | string | null | undefined,
): ThemePreferenceValue {
  return parseThemePreference(preference ?? null) ?? DEFAULT_THEME_PREFERENCE;
}

export function getThemeHtmlClass(
  preference: ThemePreferenceValue | null | undefined,
): ThemeHtmlClass {
  if (preference && preference in htmlClassByPreference) {
    return htmlClassByPreference[preference];
  }

  return htmlClassByPreference[DEFAULT_THEME_PREFERENCE];
}

export function applyThemeHtmlClass(preference: ThemePreferenceValue) {
  const root = document.documentElement;

  root.classList.remove("system", "light", "dark");
  root.classList.add(getThemeHtmlClass(preference));
}
