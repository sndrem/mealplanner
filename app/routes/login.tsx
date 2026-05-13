import { useNavigation } from "react-router";

import type { Route } from "./+types/login";
import { AuthForm, type AuthFormState } from "../features/auth/auth-form";
import { getSafeRedirectTo, loginUser, requireAnonymous, signInUser } from "../lib/auth.server";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Logg inn | Mealplanner" },
    { name: "description", content: "Logg inn for a bruke Mealplanner." },
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
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = getSafeRedirectTo(String(formData.get("redirectTo") ?? ""));

  const actionData: AuthFormState = {
    redirectTo,
    values: {
      email,
    },
  };

  if (!email.trim() || !password) {
    return {
      ...actionData,
      fieldErrors: {
        email: email.trim() ? undefined : "Skriv inn e-postadressen din.",
        password: password ? undefined : "Skriv inn passordet ditt.",
      },
    } satisfies AuthFormState;
  }

  const user = await loginUser({ email, password });

  if (!user) {
    return {
      ...actionData,
      formError: "Feil e-post eller passord.",
    } satisfies AuthFormState;
  }

  return signInUser({
    request,
    userId: user.id,
    redirectTo,
  });
}

export default function LoginRoute({ actionData, loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();

  return (
    <AuthForm
      actionData={actionData}
      description="Logg inn for a planlegge maltider sammen med familien din."
      isSubmitting={navigation.state === "submitting"}
      mode="login"
      redirectTo={actionData?.redirectTo ?? loaderData.redirectTo}
    />
  );
}
