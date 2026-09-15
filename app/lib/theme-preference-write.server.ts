import { db } from "./db.server";
import { getUserId } from "./session.server";
import {
  resolveThemePreference,
  THEME_PREFERENCE_VALUES,
  type ThemePreferenceValue,
} from "./theme-preference";

const validPreferences = new Set<ThemePreferenceValue>(THEME_PREFERENCE_VALUES);

export async function getRequestThemePreference(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    return resolveThemePreference(undefined);
  }

  const user = await db.user.findUnique({
    select: {
      themePreference: true,
    },
    where: {
      id: userId,
    },
  });

  return resolveThemePreference(user?.themePreference);
}

export async function updateUserThemePreference({
  themePreference,
  userId,
}: {
  themePreference: ThemePreferenceValue;
  userId: string;
}) {
  if (!validPreferences.has(themePreference)) {
    return {
      formError: "Ugyldig utseende.",
      status: "VALIDATION_ERROR" as const,
    };
  }

  await db.user.update({
    data: {
      themePreference,
    },
    where: {
      id: userId,
    },
  });

  return {
    status: "UPDATED" as const,
    themePreference,
  };
}
