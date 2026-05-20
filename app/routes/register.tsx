import { useNavigation } from "react-router";

import type { Route } from "./+types/register";
import { AuthForm, type AuthFormState } from "../features/auth/auth-form";
import {
  PASSWORD_MIN_LENGTH,
  getSafeRedirectTo,
  registerUser,
  requireAnonymous,
  signInUser,
} from "../lib/auth.server";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Opprett konto | Mealplanner" },
    { name: "description", content: "Opprett en konto for å bruke Mealplanner." },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);

  const url = new URL(request.url);

  return {
    redirectTo: getSafeRedirectTo(url.searchParams.get("redirectTo")),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request);

  const formData = await request.formData();
  const displayName = String(formData.get("displayName") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = getSafeRedirectTo(String(formData.get("redirectTo") ?? ""));

  const actionData: AuthFormState = {
    redirectTo,
    values: {
      displayName,
      email,
    },
  };

  const fieldErrors = {
    displayName: displayName.trim() ? undefined : "Skriv inn navnet ditt.",
    email: email.trim() ? undefined : "Skriv inn e-postadressen din.",
    password:
      password.length >= PASSWORD_MIN_LENGTH
        ? undefined
        : `Passordet må ha minst ${PASSWORD_MIN_LENGTH} tegn.`,
  };

  if (fieldErrors.displayName || fieldErrors.email || fieldErrors.password) {
    return {
      ...actionData,
      fieldErrors,
    } satisfies AuthFormState;
  }

  const result = await registerUser({ displayName, email, password });

  if ("error" in result) {
    return {
      ...actionData,
      formError: "Det finnes allerede en konto med denne e-postadressen.",
    } satisfies AuthFormState;
  }

  return signInUser({
    request,
    userId: result.user.id,
    redirectTo,
  });
}

export default function RegisterRoute({ actionData, loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();

  return (
    <AuthForm
      actionData={actionData}
      description="Opprett en konto for å komme i gang med ukeplan, handleliste og familiesamarbeid."
      isSubmitting={navigation.state === "submitting"}
      mode="register"
      redirectTo={actionData?.redirectTo ?? loaderData.redirectTo}
    />
  );
}
