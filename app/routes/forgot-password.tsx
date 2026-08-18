import { useNavigation } from "react-router";

import type { Route } from "./+types/forgot-password";
import { AuthScreen, authInputClassName, authSubmitButtonClassName } from "../features/auth/auth-screen";
import { requireAnonymous } from "../lib/auth.server";
import { requestPasswordReset } from "../lib/password-reset.server";

export interface ForgotPasswordActionData {
  fieldErrors?: {
    email?: string;
  };
  success?: boolean;
  values?: {
    email?: string;
  };
}

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Glemt passord | Mealplanner" },
    { name: "description", content: "Tilbakestill passordet ditt på Mealplanner." },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request, { authenticatedRedirectTo: "/app" });
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request, { authenticatedRedirectTo: "/app" });

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const actionData: ForgotPasswordActionData = {
    values: { email },
  };

  if (!email.trim()) {
    return {
      ...actionData,
      fieldErrors: {
        email: "Skriv inn e-postadressen din.",
      },
    } satisfies ForgotPasswordActionData;
  }

  await requestPasswordReset({
    email,
    origin: new URL(request.url).origin,
  });

  return {
    success: true,
  } satisfies ForgotPasswordActionData;
}

export default function ForgotPasswordRoute({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AuthScreen
      alternateHref="/login"
      alternateLabel="Tilbake til innlogging"
      description="Skriv inn e-postadressen din, så sender vi en lenke for å velge et nytt passord."
      heading="Glemt passord"
    >
      {actionData?.success ? (
        <p className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Hvis det finnes en konto med denne e-postadressen, har vi sendt en lenke for å tilbakestille passordet.
        </p>
      ) : (
        <form className="mt-8 space-y-5" method="post">
          <label className="block text-sm font-medium text-slate-700">
            E-post
            <input
              autoComplete="email"
              className={authInputClassName}
              defaultValue={actionData?.values?.email ?? ""}
              name="email"
              placeholder="navn@eksempel.no"
              type="email"
            />
            {actionData?.fieldErrors?.email ? (
              <span className="mt-2 block text-sm text-rose-600">{actionData.fieldErrors.email}</span>
            ) : null}
          </label>

          <button className={authSubmitButtonClassName} disabled={isSubmitting} type="submit">
            {isSubmitting ? "Jobber..." : "Send lenke"}
          </button>
        </form>
      )}
    </AuthScreen>
  );
}
