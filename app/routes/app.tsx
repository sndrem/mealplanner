import { Form, Link, useNavigation } from "react-router";

import type { Route } from "./+types/app";
import { requireUser } from "../lib/auth.server";
import {
  createFamilyForUser,
  getFamilyMembershipsForUser,
  joinFamilyByCode,
} from "../lib/family.server";

interface AppActionData {
  fieldErrors?: {
    familyName?: string;
    joinCode?: string;
  };
  formError?: string;
  intent?: "create-family" | "join-family";
  values?: {
    familyName?: string;
    joinCode?: string;
  };
}

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Mealplanner app" },
    { name: "description", content: "Beskyttet oversikt for Mealplanner." },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const memberships = await getFamilyMembershipsForUser(user.id);

  return {
    memberships,
    user,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create-family") {
    const familyName = String(formData.get("familyName") ?? "");

    if (!familyName.trim()) {
      return {
        fieldErrors: {
          familyName: "Skriv inn et familienavn.",
        },
        intent,
        values: {
          familyName,
        },
      } satisfies AppActionData;
    }

    await createFamilyForUser({
      name: familyName,
      userId: user.id,
    });

    return Response.redirect(new URL("/app", request.url), 302);
  }

  if (intent === "join-family") {
    const joinCode = String(formData.get("joinCode") ?? "");

    if (!joinCode.trim()) {
      return {
        fieldErrors: {
          joinCode: "Skriv inn familiekoden.",
        },
        intent,
        values: {
          joinCode,
        },
      } satisfies AppActionData;
    }

    const result = await joinFamilyByCode({
      joinCode,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ingen familie med denne koden.",
        intent,
        values: {
          joinCode,
        },
      } satisfies AppActionData;
    }

    return Response.redirect(new URL("/app", request.url), 302);
  }

  return {
    formError: "Ukjent handling.",
  } satisfies AppActionData;
}

export default function AppRoute({ actionData, loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const hasFamilies = loaderData.memberships.length > 0;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Mealplanner
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">Hei, {loaderData.user.displayName}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                {hasFamilies
                  ? "Du er logget inn og klar for neste steg i produksjonsappen."
                  : "Du er logget inn. Opprett en familie eller bli med i en eksisterende familie for a komme videre."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                to="/prototype"
              >
                Se prototype
              </Link>
              <Form action="/logout" method="post">
                <button
                  className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                  type="submit"
                >
                  Logg ut
                </button>
              </Form>
            </div>
          </div>
        </section>

        {hasFamilies ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              {loaderData.memberships.map((membership) => (
                <article
                  key={membership.id}
                  className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-950">{membership.family.name}</h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                      {membership.role === "ADMIN" ? "Admin" : "Medlem"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Familiekode: <span className="font-semibold text-slate-900">{membership.family.joinCode}</span>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Denne delen er klar for videre arbeid med ukeplaner, handlelister og samarbeid.
                  </p>
                </article>
              ))}
            </section>

            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-950">Hva kommer na</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Auth, session og beskyttede ruter er pa plass. Neste steg er a bygge ukeplaner, familievisning
                og handleliste pa toppen av ekte serverdata.
              </p>
            </section>
          </>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-950">Opprett familie</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Lag en ny familie og bli automatisk administrator.
              </p>

              <Form className="mt-6 space-y-4" method="post">
                <input name="intent" type="hidden" value="create-family" />

                <label className="block text-sm font-medium text-slate-700">
                  Familienavn
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={actionData?.intent === "create-family" ? actionData.values?.familyName ?? "" : ""}
                    name="familyName"
                    placeholder="For eksempel Solberg"
                    type="text"
                  />
                </label>

                {actionData?.intent === "create-family" && actionData.fieldErrors?.familyName ? (
                  <p className="text-sm text-rose-600">{actionData.fieldErrors.familyName}</p>
                ) : null}

                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Lagrer..." : "Opprett familie"}
                </button>
              </Form>
            </article>

            <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-950">Bli med i familie</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Har du allerede en familiekode? Skriv den inn her.
              </p>

              <Form className="mt-6 space-y-4" method="post">
                <input name="intent" type="hidden" value="join-family" />

                <label className="block text-sm font-medium text-slate-700">
                  Familiekode
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm uppercase tracking-[0.24em] text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={actionData?.intent === "join-family" ? actionData.values?.joinCode ?? "" : ""}
                    name="joinCode"
                    placeholder="ABC123"
                    type="text"
                  />
                </label>

                {actionData?.intent === "join-family" && actionData.fieldErrors?.joinCode ? (
                  <p className="text-sm text-rose-600">{actionData.fieldErrors.joinCode}</p>
                ) : null}
                {actionData?.intent === "join-family" && actionData.formError ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {actionData.formError}
                  </p>
                ) : null}

                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Lagrer..." : "Bli med"}
                </button>
              </Form>
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
