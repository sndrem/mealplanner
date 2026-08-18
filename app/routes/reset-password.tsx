import { Link, useNavigation } from "react-router";

import type { Route } from "./+types/reset-password";
import { AuthScreen, authInputClassName, authSubmitButtonClassName } from "../features/auth/auth-screen";
import { PASSWORD_MIN_LENGTH, requireAnonymous, signInUser } from "../lib/auth.server";
import { getValidPasswordResetToken, resetPasswordWithToken } from "../lib/password-reset.server";

export interface ResetPasswordActionData {
  fieldErrors?: {
    password?: string;
  };
  formError?: string;
  token?: string;
}

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Tilbakestill passord | Mealplanner" },
    { name: "description", content: "Velg et nytt passord for Mealplanner." },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request, { authenticatedRedirectTo: "/app" });

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const validToken = await getValidPasswordResetToken(token);

  return {
    isValid: Boolean(validToken),
    token,
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request, { authenticatedRedirectTo: "/app" });

  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const actionData: ResetPasswordActionData = { token };

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ...actionData,
      fieldErrors: {
        password: `Passordet må ha minst ${PASSWORD_MIN_LENGTH} tegn.`,
      },
    } satisfies ResetPasswordActionData;
  }

  const result = await resetPasswordWithToken({
    password,
    rawToken: token,
  });

  if ("error" in result) {
    return {
      ...actionData,
      formError: "Lenken er ugyldig eller utløpt. Be om en ny lenke og prøv igjen.",
    } satisfies ResetPasswordActionData;
  }

  return signInUser({
    request,
    userId: result.userId,
    redirectTo: "/app",
  });
}

export default function ResetPasswordRoute({ actionData, loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const token = actionData?.token ?? loaderData.token;
  const showForm = loaderData.isValid && !actionData?.formError;

  return (
    <AuthScreen
      alternateHref="/forgot-password"
      alternateLabel="Be om ny lenke"
      description="Velg et nytt passord for å logge inn igjen."
      heading="Tilbakestill passord"
    >
      {showForm ? (
        <form className="mt-8 space-y-5" method="post">
          <input name="token" type="hidden" value={token} />

          <label className="block text-sm font-medium text-slate-700">
            Nytt passord
            <input
              autoComplete="new-password"
              className={authInputClassName}
              name="password"
              placeholder={`Minst ${PASSWORD_MIN_LENGTH} tegn`}
              type="password"
            />
            {actionData?.fieldErrors?.password ? (
              <span className="mt-2 block text-sm text-rose-600">{actionData.fieldErrors.password}</span>
            ) : null}
          </label>

          <button className={authSubmitButtonClassName} disabled={isSubmitting} type="submit">
            {isSubmitting ? "Jobber..." : "Lagre nytt passord"}
          </button>
        </form>
      ) : (
        <div className="mt-8 space-y-4">
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionData?.formError ?? "Lenken er ugyldig eller utløpt. Be om en ny lenke og prøv igjen."}
          </p>
          <Link className="inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800" to="/forgot-password">
            Glemt passord
          </Link>
        </div>
      )}
    </AuthScreen>
  );
}
