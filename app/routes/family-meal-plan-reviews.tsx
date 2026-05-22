import { Link, type MetaFunction } from "react-router";

import { requireUser } from "../lib/auth.server";
import { listPendingReviewsForUser } from "../lib/meal-plan-share.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Til gjennomgang | Mealplanner" },
    {
      name: "description",
      content: "Ukeplaner som venter på din tilbakemelding.",
    },
  ];
};

export async function loader({
  params,
  request,
}: {
  params: { familyId?: string };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");

  const notice = new URL(request.url).searchParams.get("notice");

  return {
    ...(await listPendingReviewsForUser({
      familyId,
      userId: user.id,
    })),
    notice: notice === "meal-plan-approved" ? ("meal-plan-approved" as const) : null,
  };
}

export default function FamilyMealPlanReviewsRoute({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const pendingReviews = loaderData.reviews.filter(
    (review) => review.status === "PENDING" || review.status === "VIEWED",
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <section className="rounded-[28px] bg-slate-950 px-5 py-6 text-white shadow-xl">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
            Gjennomgang
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Til gjennomgang
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {loaderData.family.name} — gi tilbakemelding på delte ukeplaner.
          </p>
        </section>

        {loaderData.notice === "meal-plan-approved" ? (
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950">
            <h2 className="text-base font-semibold">Ukeplan godkjent</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              Takk — ukeplanen er godkjent og klar for neste steg.
            </p>
          </section>
        ) : null}

        {loaderData.reviews.length === 0 ? (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm leading-6 text-slate-600">
              Ingen ukeplaner venter på deg akkurat nå.
            </p>
            <Link
              className="mt-4 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              to={`/families/${loaderData.family.id}/meal-plans`}
            >
              Til ukeplaner
            </Link>
          </section>
        ) : (
          <section className="space-y-3">
            {pendingReviews.length > 0 ? (
              <p className="text-sm font-medium text-slate-700">
                {pendingReviews.length}{" "}
                {pendingReviews.length === 1 ? "plan venter" : "planer venter"}{" "}
                på deg
              </p>
            ) : null}

            {loaderData.reviews.map((review) => {
              const needsResponse =
                review.status === "PENDING" || review.status === "VIEWED";

              return (
                <article
                  key={review.id}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-950">
                      {review.mealPlan.title}
                    </h2>
                    <span
                      className={
                        needsResponse
                          ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900"
                          : "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                      }
                    >
                      {needsResponse ? "Venter på deg" : "Du har svart"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatMealPlanWindow(
                      review.mealPlan.startDate,
                      review.mealPlan.endDate,
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Delt av {review.share.sharedByDisplayName}
                    {review.share.message
                      ? ` — «${review.share.message}»`
                      : null}
                  </p>
                  <Link
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                    to={`/families/${loaderData.family.id}/meal-plans/${review.mealPlan.id}/review?shareId=${review.share.id}`}
                  >
                    {needsResponse ? "Gi tilbakemelding" : "Se tilbakemelding"}
                  </Link>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function requireRouteParam(
  value: string | undefined,
  message: string,
): string {
  if (!value) {
    throw new Response(message, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return value;
}

function formatMealPlanWindow(startDate: string, endDate: string) {
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
