import {
  Form,
  Link,
  isRouteErrorResponse,
  useNavigation,
  type MetaFunction,
} from "react-router";

import { requireUser } from "../lib/auth.server";
import { getFamilyKassalappIntegrationData } from "../lib/kassalapp-integration.server";
import {
  removeFamilyKassalappApiToken,
  saveFamilyKassalappApiToken,
} from "../lib/kassalapp-integration-write.server";

type KassalappNotice = "token-removed" | "token-saved";

type KassalappIntent = "remove-token" | "save-token";

interface KassalappActionData {
  fieldErrors?: {
    apiToken?: string;
  };
  formError?: string;
  intent?: KassalappIntent;
}

interface FamilyKassalappRouteProps {
  actionData?: KassalappActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Kassalapp | Mealplanner" },
    {
      name: "description",
      content:
        "Koble familiens Kassalapp API-nøkkel for prisoverslag i handlelisten.",
    },
  ];
};

export async function loader({
  params,
  request,
}: {
  params: {
    familyId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireFamilyId(params.familyId);
  const result = await getFamilyKassalappIntegrationData({
    familyId,
    userId: user.id,
  });

  return {
    family: result.family,
    integration: result.integration,
    notice: getKassalappNotice(request),
    userRole: result.userRole,
  };
}

export async function action({
  params,
  request,
}: {
  params: {
    familyId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireFamilyId(params.familyId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "save-token") {
    const result = await saveFamilyKassalappApiToken({
      apiToken: String(formData.get("apiToken") ?? ""),
      familyId,
      userId: user.id,
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        fieldErrors: result.fieldErrors,
        intent,
      } satisfies KassalappActionData;
    }

    return buildKassalappRedirect({
      familyId,
      notice: "token-saved",
      request,
    });
  }

  if (intent === "remove-token") {
    const result = await removeFamilyKassalappApiToken({
      familyId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ingen lagret Kassalapp-nøkkel for familien.",
        intent,
      } satisfies KassalappActionData;
    }

    return buildKassalappRedirect({
      familyId,
      notice: "token-removed",
      request,
    });
  }

  return {
    formError: "Ukjent handling.",
  } satisfies KassalappActionData;
}

export default function FamilyKassalappRoute({
  actionData,
  loaderData,
}: FamilyKassalappRouteProps) {
  const navigation = useNavigation();
  const noticeContent = loaderData.notice
    ? getKassalappNoticeContent(loaderData.notice)
    : null;
  const pendingIntent = navigation.formData?.get("intent");
  const canManageIntegration = loaderData.userRole === "ADMIN";
  const isConfigured = loaderData.integration.isConfigured;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Kassalapp
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {loaderData.family.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Koble familiens egen Kassalapp API-nøkkel for å estimere
                handlelistepriser. Nøkkelen lagres kryptert og brukes bare for
                denne familien.
              </p>
            </div>

            <Link
              className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
              to={`/families/${loaderData.family.id}`}
            >
              Tilbake til familie
            </Link>
          </div>
        </section>

        {noticeContent ? (
          <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-emerald-950 shadow-sm">
            <h2 className="text-base font-semibold">{noticeContent.title}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              {noticeContent.description}
            </p>
          </section>
        ) : null}

        {actionData?.formError ? (
          <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-900 shadow-sm">
            <h2 className="text-base font-semibold">
              Kunne ikke oppdatere Kassalapp
            </h2>
            <p className="mt-2 text-sm leading-6">{actionData.formError}</p>
          </section>
        ) : null}

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-950">Status</h2>
          {isConfigured ? (
            <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
              <p>
                Kassalapp er koblet til for familien. Lagret nøkkel slutter på{" "}
                <span className="font-mono text-slate-950">
                  ...{loaderData.integration.tokenLastFour}
                </span>
                .
              </p>
              <p>
                Sist oppdatert{" "}
                {formatIntegrationTimestamp(loaderData.integration.updatedAt)}.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Ingen API-nøkkel er lagret for familien ennå. Prisoverslag i
              handlelisten blir utilgjengelig til en administrator legger inn en
              nøkkel.
            </p>
          )}
        </section>

        {canManageIntegration ? (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">
              {isConfigured ? "Oppdater API-nøkkel" : "Legg inn API-nøkkel"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Hent nøkkelen fra{" "}
              <a
                className="font-medium text-slate-950 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
                href="https://kassal.app"
                rel="noreferrer"
                target="_blank"
              >
                kassal.app
              </a>
              . Den lagres kryptert i databasen og vises aldri i klartekst
              etter lagring.
            </p>

            <Form className="mt-6 space-y-4" method="post">
              <input name="intent" type="hidden" value="save-token" />
              <label className="block text-sm font-medium text-slate-700">
                API-nøkkel
                <input
                  autoComplete="off"
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  name="apiToken"
                  placeholder="Lim inn Kassalapp API-nøkkel"
                  spellCheck={false}
                  type="password"
                />
              </label>
              {actionData?.intent === "save-token" &&
              actionData.fieldErrors?.apiToken ? (
                <p className="text-sm text-rose-600">
                  {actionData.fieldErrors.apiToken}
                </p>
              ) : null}
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={
                  navigation.state === "submitting" &&
                  pendingIntent === "save-token"
                }
                type="submit"
              >
                {navigation.state === "submitting" &&
                pendingIntent === "save-token"
                  ? "Lagrer..."
                  : isConfigured
                    ? "Oppdater nøkkel"
                    : "Lagre nøkkel"}
              </button>
            </Form>

            {isConfigured ? (
              <Form className="mt-4" method="post">
                <input name="intent" type="hidden" value="remove-token" />
                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    navigation.state === "submitting" &&
                    pendingIntent === "remove-token"
                  }
                  type="submit"
                >
                  {navigation.state === "submitting" &&
                  pendingIntent === "remove-token"
                    ? "Fjerner..."
                    : "Fjern nøkkel"}
                </button>
              </Form>
            ) : null}
          </section>
        ) : (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">
              Kun for administratorer
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Bare familieadministratorer kan legge inn eller fjerne
              Kassalapp-nøkkelen.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi klarte ikke å laste Kassalapp-innstillingene akkurat nå.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Fant ikke familien" : title;
    message =
      typeof error.data === "string" && error.data.length > 0
        ? error.data
        : error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-16 text-slate-900">
      <div className="mx-auto max-w-2xl rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white"
          to="/app"
        >
          Til appen
        </Link>
      </div>
    </main>
  );
}

function getKassalappNotice(request: Request): KassalappNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (notice === "token-saved" || notice === "token-removed") {
    return notice;
  }

  return null;
}

function getKassalappNoticeContent(notice: KassalappNotice) {
  switch (notice) {
    case "token-saved":
      return {
        description:
          "Familiens Kassalapp API-nøkkel er lagret og kan brukes til prisoverslag.",
        title: "API-nøkkel lagret",
      };
    case "token-removed":
      return {
        description:
          "Prisoverslag blir utilgjengelig til en administrator legger inn en ny nøkkel.",
        title: "API-nøkkel fjernet",
      };
  }
}

function buildKassalappRedirect({
  familyId,
  notice,
  request,
}: {
  familyId: string;
  notice: KassalappNotice;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/kassalapp`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}

function formatIntegrationTimestamp(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function requireFamilyId(familyId: string | undefined) {
  if (!familyId) {
    throw new Response("Fant ikke familien.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return familyId;
}
