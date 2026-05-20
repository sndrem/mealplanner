import { Form, Link, isRouteErrorResponse, useNavigation } from "react-router";

import { requireUser } from "../lib/auth.server";
import { requireFamilyAdmin } from "../lib/family.server";
import {
  runNotionImport,
  validateNotionPayload,
  type NotionImportSummary,
} from "../lib/notion-import.server";

type ImportIntent = "dry-run-import" | "run-import";

interface ImportActionData {
  formError?: string;
  intent?: ImportIntent;
  summary?: NotionImportSummary;
}

interface FamilyRecipeImportRouteProps {
  actionData?: ImportActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta = () => {
  return [
    { title: "Importer oppskrifter | Mealplanner" },
    {
      name: "description",
      content: "Importer Notion-ingredienser og oppskrifter til familien.",
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
  const membership = await requireFamilyAdmin({
    familyId,
    userId: user.id,
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
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
  await requireFamilyAdmin({
    familyId,
    userId: user.id,
  });
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "dry-run-import") {
    const summary = await validateNotionPayload();

    return {
      intent,
      summary,
    } satisfies ImportActionData;
  }

  if (intent === "run-import") {
    const summary = await runNotionImport({
      dryRun: false,
      familyId,
      userId: user.id,
    });

    return {
      intent,
      summary,
    } satisfies ImportActionData;
  }

  return {
    formError: "Ukjent handling.",
  } satisfies ImportActionData;
}

export default function FamilyRecipeImportRoute({
  actionData,
  loaderData,
}: FamilyRecipeImportRouteProps) {
  const navigation = useNavigation();
  const pendingIntent = navigation.formData?.get("intent");

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <section className="rounded-[28px] border-2 border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">
                Notion-import for {loaderData.family.name}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Kjør først dry-run for validering. Deretter kan du importere
                kategorier, ingredienser og oppskrifter i riktig rekkefølge.
              </p>
            </div>
            <Link
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              to={`/families/${loaderData.family.id}/recipes`}
            >
              Tilbake til oppskrifter
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <Form className="flex flex-wrap gap-3" method="post">
            <button
              className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-900 ring-1 ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={navigation.state === "submitting"}
              name="intent"
              type="submit"
              value="dry-run-import"
            >
              {navigation.state === "submitting" &&
              pendingIntent === "dry-run-import"
                ? "Validerer..."
                : "Kjør dry-run"}
            </button>
            <button
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={navigation.state === "submitting"}
              name="intent"
              type="submit"
              value="run-import"
            >
              {navigation.state === "submitting" &&
              pendingIntent === "run-import"
                ? "Importerer..."
                : "Kjør import"}
            </button>
          </Form>
        </section>

        {actionData?.formError ? (
          <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-900 shadow-sm">
            <p className="text-sm">{actionData.formError}</p>
          </section>
        ) : null}

        {actionData?.summary ? (
          <ImportSummaryCard summary={actionData.summary} />
        ) : null}
      </div>
    </main>
  );
}

function ImportSummaryCard({ summary }: { summary: NotionImportSummary }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Importrapport</h2>
      <p className="mt-1 text-sm text-slate-600">Modus: {summary.mode}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <PhaseCard phase="Kategorier" summary={summary.categories} />
        <PhaseCard phase="Ingredienser" summary={summary.ingredients} />
        <PhaseCard phase="Oppskrifter" summary={summary.recipes} />
      </div>
    </section>
  );
}

function PhaseCard({
  phase,
  summary,
}: {
  phase: string;
  summary: NotionImportSummary["categories"];
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{phase}</h3>
      <dl className="mt-3 grid gap-1 text-sm text-slate-700">
        <div className="flex items-center justify-between">
          <dt>Opprettet</dt>
          <dd>{summary.created}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Oppdatert</dt>
          <dd>{summary.updated}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Hoppet over</dt>
          <dd>{summary.skipped}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Feil</dt>
          <dd>{summary.errors.length}</dd>
        </div>
      </dl>
      {summary.errors.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-rose-700">
          {summary.errors.slice(0, 5).map((error) => (
            <li key={`${error.code}-${error.notionPageId ?? "unknown"}`}>
              {error.code}: {error.message}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi kunne ikke gjennomføre importen akkurat nå.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Fant ikke siden" : title;
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
      </div>
    </main>
  );
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
