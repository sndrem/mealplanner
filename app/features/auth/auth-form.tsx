import { Link } from "react-router";

import { AuthScreen, authInputClassName, authSubmitButtonClassName } from "./auth-screen";

export interface AuthFormState {
  formError?: string;
  fieldErrors?: {
    displayName?: string;
    email?: string;
    password?: string;
  };
  redirectTo?: string;
  values?: {
    displayName?: string;
    email?: string;
  };
}

interface AuthFormProps {
  actionData?: AuthFormState;
  description: string;
  isSubmitting: boolean;
  mode: "login" | "register";
  redirectTo: string;
}

export function AuthForm({ actionData, description, isSubmitting, mode, redirectTo }: AuthFormProps) {
  const isRegisterMode = mode === "register";
  const heading = isRegisterMode ? "Opprett konto" : "Logg inn";
  const submitLabel = isRegisterMode ? "Opprett konto" : "Logg inn";
  const alternateHref = isRegisterMode
    ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
    : `/register?redirectTo=${encodeURIComponent(redirectTo)}`;
  const alternateLabel = isRegisterMode ? "Har du allerede konto? Logg inn" : "Ingen konto enda? Opprett en";

  return (
    <AuthScreen
      alternateHref={alternateHref}
      alternateLabel={alternateLabel}
      description={description}
      heading={heading}
    >
      <form className="mt-8 space-y-5" method="post">
        <input name="redirectTo" type="hidden" value={redirectTo} />

        {isRegisterMode ? (
          <label className="block text-sm font-medium text-slate-700">
            Navn
            <input
              className={authInputClassName}
              defaultValue={actionData?.values?.displayName ?? ""}
              name="displayName"
              placeholder="Fornavn eller familienavn"
              type="text"
            />
            {actionData?.fieldErrors?.displayName ? (
              <span className="mt-2 block text-sm text-rose-600">{actionData.fieldErrors.displayName}</span>
            ) : null}
          </label>
        ) : null}

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

        <label className="block text-sm font-medium text-slate-700">
          Passord
          <input
            autoComplete={isRegisterMode ? "new-password" : "current-password"}
            className={authInputClassName}
            name="password"
            placeholder="Minst 8 tegn"
            type="password"
          />
          {actionData?.fieldErrors?.password ? (
            <span className="mt-2 block text-sm text-rose-600">{actionData.fieldErrors.password}</span>
          ) : null}
        </label>

        {!isRegisterMode ? (
          <p>
            <Link className="text-sm font-medium text-emerald-700 hover:text-emerald-800" to="/forgot-password">
              Glemt passord?
            </Link>
          </p>
        ) : null}

        {actionData?.formError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionData.formError}
          </p>
        ) : null}

        <button className={authSubmitButtonClassName} disabled={isSubmitting} type="submit">
          {isSubmitting ? "Jobber..." : submitLabel}
        </button>
      </form>
    </AuthScreen>
  );
}
