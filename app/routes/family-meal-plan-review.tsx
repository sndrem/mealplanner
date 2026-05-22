import { Form, Link, useNavigation, type MetaFunction } from "react-router";

import { requireUser } from "../lib/auth.server";
import { getMealPlanReviewQuickResponseOptions } from "../lib/meal-plan-review-presets";
import {
  approveMealPlanFromShareReview,
  getMealPlanShareReviewData,
  recordShareViewed,
  upsertDayReviewComment,
} from "../lib/meal-plan-share.server";

type ReviewIntent = "approve-meal-plan" | "save-day-feedback" | "save-day-note";

interface ReviewActionData {
  approvalFormError?: string;
  date?: string;
  formError?: string;
  intent?: ReviewIntent;
  ok?: boolean;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Gjennomgang av ukeplan | Mealplanner" },
    {
      name: "description",
      content: "Gi tilbakemelding på en delt ukeplan.",
    },
  ];
};

export async function loader({
  params,
  request,
}: {
  params: { familyId?: string; mealPlanId?: string };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const mealPlanId = requireRouteParam(
    params.mealPlanId,
    "Fant ikke ukeplanen.",
  );
  const shareId = new URL(request.url).searchParams.get("shareId");

  if (!shareId) {
    throw new Response("Fant ikke delingen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  await recordShareViewed({
    familyId,
    mealPlanId,
    shareId,
    userId: user.id,
  });

  const data = await getMealPlanShareReviewData({
    familyId,
    mealPlanId,
    shareId,
    userId: user.id,
  });

  const url = new URL(request.url);
  const notice = url.searchParams.get("notice");

  return {
    ...data,
    notice:
      notice === "meal-plan-approved" ? ("meal-plan-approved" as const) : null,
    quickResponseOptions: getMealPlanReviewQuickResponseOptions(),
    shareId,
  };
}

export async function action({
  params,
  request,
}: {
  params: { familyId?: string; mealPlanId?: string };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const mealPlanId = requireRouteParam(
    params.mealPlanId,
    "Fant ikke ukeplanen.",
  );
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const shareId = String(formData.get("shareId") ?? "");
  const date = String(formData.get("date") ?? "");

  if (!shareId) {
    return {
      formError: "Fant ikke delingen.",
      intent: intent as ReviewIntent,
    } satisfies ReviewActionData;
  }

  if (intent === "approve-meal-plan") {
    const result = await approveMealPlanFromShareReview({
      familyId,
      mealPlanId,
      shareId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw new Response("Fant ikke ukeplanen.", {
        status: 404,
        statusText: "Not Found",
      });
    }

    if (
      result.status === "CONFLICT" ||
      result.status === "INVALID_TRANSITION" ||
      result.status === "NOT_DRAFT" ||
      result.status === "SHARE_CLOSED"
    ) {
      return {
        approvalFormError: result.formError,
        intent,
      } satisfies ReviewActionData;
    }

    if (result.status === "APPROVED") {
      const url = new URL(request.url);
      url.pathname = `/families/${familyId}/meal-plans/reviews`;
      url.search = "";
      url.searchParams.set("notice", "meal-plan-approved");

      return Response.redirect(url.toString(), 302);
    }

    return {
      approvalFormError: "Kunne ikke godkjenne ukeplanen.",
      intent,
    } satisfies ReviewActionData;
  }

  if (intent === "save-day-feedback" || intent === "save-day-note") {
    const result = await upsertDayReviewComment({
      body:
        intent === "save-day-note"
          ? String(formData.get("body") ?? "")
          : undefined,
      date,
      familyId,
      mealPlanId,
      quickResponse:
        intent === "save-day-feedback"
          ? String(formData.get("quickResponse") ?? "")
          : undefined,
      shareId,
      userId: user.id,
    });

    if (result.status !== "SAVED") {
      return {
        date,
        formError: result.formError,
        intent: intent as ReviewIntent,
      } satisfies ReviewActionData;
    }

    return {
      date,
      intent: intent as ReviewIntent,
      ok: true,
    } satisfies ReviewActionData;
  }

  return {
    formError: "Ugyldig handling.",
  } satisfies ReviewActionData;
}

export default function FamilyMealPlanReviewRoute({
  actionData,
  loaderData,
}: {
  actionData?: ReviewActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const navigation = useNavigation();
  const pendingIntent = navigation.formData?.get("intent");
  const pendingDate = navigation.formData?.get("date");
  const isApprovingMealPlan =
    navigation.state === "submitting" && pendingIntent === "approve-meal-plan";
  const recipientLabel =
    loaderData.mealPlan.status === "APPROVED"
      ? "Godkjent"
      : loaderData.recipientStatus === "RESPONDED"
        ? "Du har svart"
        : "Venter på deg";

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <section className="sticky top-14 z-40 rounded-[24px] bg-slate-950 px-4 py-4 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-200">
                Gjennomgang
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold">
                {loaderData.mealPlan.title}
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                {formatMealPlanWindow(
                  loaderData.mealPlan.startDate,
                  loaderData.mealPlan.endDate,
                )}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Delt av {loaderData.share.sharedByDisplayName}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
              {recipientLabel}
            </span>
          </div>
          {loaderData.share.message ? (
            <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-sm text-slate-200">
              {loaderData.share.message}
            </p>
          ) : null}
        </section>

        {loaderData.notice === "meal-plan-approved" ? (
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950">
            <h2 className="text-base font-semibold">Ukeplan godkjent</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              Ukeplanen er godkjent. Tilbakemelding per dag var valgfritt.
            </p>
          </section>
        ) : null}

        {loaderData.canApprove ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm mt-15">
            <h2 className="text-base font-semibold text-slate-950">
              Godkjenn ukeplanen
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Du trenger ikke legge inn tilbakemelding på hver dag. Godkjenn når
              planen ser bra ut.
            </p>
            <Form className="mt-4" method="post">
              <input name="intent" type="hidden" value="approve-meal-plan" />
              <input name="shareId" type="hidden" value={loaderData.shareId} />
              {actionData?.intent === "approve-meal-plan" &&
              actionData.approvalFormError ? (
                <p className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {actionData.approvalFormError}
                </p>
              ) : null}
              <button
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                disabled={isApprovingMealPlan}
                type="submit"
              >
                {isApprovingMealPlan ? "Godkjenner..." : "Godkjenn ukeplan"}
              </button>
            </Form>
          </section>
        ) : null}

        <p className="text-sm text-slate-600">
          Valgfri tilbakemelding per dag:
        </p>

        <div className="flex flex-col gap-3 pb-8">
          {loaderData.days.map((day) => {
            const isSubmittingDay =
              navigation.state === "submitting" && pendingDate === day.date;
            const dayError =
              actionData?.date === day.date ? actionData.formError : undefined;
            const selectedQuickResponse = day.comment?.quickResponse ?? null;

            return (
              <article
                key={day.date}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <header className="mb-3">
                  <h2 className="text-base font-semibold text-slate-950">
                    {formatWeekdayLabel(day.date)}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {formatShortDate(day.date)}
                  </p>
                </header>

                {day.dinner?.recipeTitle ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 ring-1 ring-emerald-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
                      Middag
                    </p>
                    <p className="mt-2 text-lg font-semibold leading-snug text-slate-950">
                      {day.dinner.recipeTitle}
                    </p>
                    {day.dinner.note ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {day.dinner.note}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Middag
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Ingen middag valgt
                    </p>
                  </div>
                )}

                {loaderData.canApprove ? (
                  <div className="mt-4 flex flex-col gap-2">
                    {loaderData.quickResponseOptions.map((option) => {
                      const isSelected = selectedQuickResponse === option.value;
                      const isSubmittingChip =
                        isSubmittingDay &&
                        pendingIntent === "save-day-feedback" &&
                        navigation.formData?.get("quickResponse") ===
                          option.value;

                      return (
                        <Form
                          key={option.value}
                          className="contents"
                          method="post"
                        >
                          <input
                            name="intent"
                            type="hidden"
                            value="save-day-feedback"
                          />
                          <input
                            name="shareId"
                            type="hidden"
                            value={loaderData.shareId}
                          />
                          <input name="date" type="hidden" value={day.date} />
                          <input
                            name="quickResponse"
                            type="hidden"
                            value={option.value}
                          />
                          <button
                            className={[
                              "inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed",
                              isSelected
                                ? "bg-emerald-600 text-white ring-2 ring-emerald-300"
                                : "bg-slate-100 text-slate-900 hover:bg-slate-200",
                            ].join(" ")}
                            disabled={isSubmittingDay}
                            type="submit"
                          >
                            {isSubmittingChip ? "Lagrer..." : option.label}
                          </button>
                        </Form>
                      );
                    })}
                  </div>
                ) : day.comment ? (
                  <p className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {day.comment.feedbackLabel}
                  </p>
                ) : null}

                {loaderData.canApprove ? (
                  <details className="mt-3 group">
                    <summary className="cursor-pointer list-none text-sm font-medium text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
                      Annet
                    </summary>
                    <Form className="mt-3 space-y-2" method="post">
                      <input
                        name="intent"
                        type="hidden"
                        value="save-day-note"
                      />
                      <input
                        name="shareId"
                        type="hidden"
                        value={loaderData.shareId}
                      />
                      <input name="date" type="hidden" value={day.date} />
                      <textarea
                        className="min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                        defaultValue={day.comment?.body ?? ""}
                        name="body"
                        placeholder="Skriv et kort notat..."
                        rows={3}
                      />
                      <button
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={
                          isSubmittingDay && pendingIntent === "save-day-note"
                        }
                        type="submit"
                      >
                        {isSubmittingDay && pendingIntent === "save-day-note"
                          ? "Lagrer..."
                          : "Lagre notat"}
                      </button>
                    </Form>
                  </details>
                ) : null}

                {day.comment &&
                !day.comment.quickResponse &&
                day.comment.body ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Lagret: {day.comment.feedbackLabel}
                  </p>
                ) : null}

                {dayError ? (
                  <p className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {dayError}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          to={`/families/${loaderData.family.id}/meal-plans/reviews`}
        >
          Tilbake til gjennomgang
        </Link>
      </div>
    </main>
  );
}

function requireRouteParam(value: string | undefined, message: string): string {
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

function formatWeekdayLabel(date: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
