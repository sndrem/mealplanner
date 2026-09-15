import { redirect } from "react-router";

import type { Route } from "./+types/theme";
import { requireUser } from "../lib/auth.server";
import { parseThemePreference } from "../lib/theme-preference";
import { updateUserThemePreference } from "../lib/theme-preference-write.server";

export async function loader() {
  throw redirect("/app");
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const themePreference = parseThemePreference(formData.get("themePreference"));

  if (!themePreference) {
    return {
      formError: "Ugyldig utseende.",
      status: "VALIDATION_ERROR" as const,
    };
  }

  return updateUserThemePreference({
    themePreference,
    userId: user.id,
  });
}
