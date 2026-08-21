import { useEffect, useState } from "react";
import {
  Form,
  Link,
  isRouteErrorResponse,
  redirect,
  useNavigation,
  type MetaFunction,
} from "react-router";

import { requireUser } from "../lib/auth.server";
import {
  createShoppingListShare,
  getShoppingShareCurationData,
  type ShoppingShareCurationItem,
} from "../lib/shopping-share.server";
import { buildShoppingShareItemSelectionKey } from "../lib/shopping-share";
import {
  storeModePageClass,
  storeModeSectionCardClass,
  storeModeSurfaceCardClass,
} from "../lib/store-mode-theme";
import type { Route } from "./+types/family-store-mode-share";

interface ShareActionData {
  formError?: string;
  shareUrl?: string;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Del handleliste | Mealplanner" },
    {
      name: "description",
      content: "Velg varer og lag en lenke du kan sende til butikken.",
    },
  ];
};

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const curation = await getShoppingShareCurationData({
    familyId,
    userId: user.id,
  });

  if (!curation) {
    throw redirect(`/families/${familyId}/meal-plans`);
  }

  return curation;
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const formData = await request.formData();
  const selectedKeys = formData
    .getAll("item")
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
  const result = await createShoppingListShare({
    familyId,
    selectedKeys,
    userId: user.id,
  });

  if (result.status === "NOT_FOUND") {
    throw redirect(`/families/${familyId}/meal-plans`);
  }

  if (result.status === "VALIDATION_ERROR") {
    return {
      formError: result.formError,
    } satisfies ShareActionData;
  }

  const origin = new URL(request.url).origin;

  return {
    shareUrl: `${origin}/s/${result.token}`,
  } satisfies ShareActionData;
}

export default function FamilyStoreModeShareRoute({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className={storeModePageClass}>
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <section className={`${storeModeSurfaceCardClass} p-6`}>
          <p className="text-sm text-stone-500">
            <Link
              className="underline-offset-2 hover:text-stone-950 hover:underline"
              to={`/families/${loaderData.family.id}/store-mode`}
            >
              Butikkmodus
            </Link>
            {" · "}
            Del liste
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            Del handleliste
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Fjern varer du ikke vil ha med. Allerede kryssede varer er utelatt
            som standard. Når du oppretter lenken, fryses listen slik den er nå.
          </p>
        </section>

        {actionData?.shareUrl ? (
          <ShareUrlResult shareUrl={actionData.shareUrl} />
        ) : null}

        {actionData?.formError ? (
          <p className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
            {actionData.formError}
          </p>
        ) : null}

        <Form className="grid gap-4" method="post">
          <CurationSection
            defaultSelected
            emptyText="Ingen varer å handle akkurat nå."
            items={loaderData.pendingItems}
            title="Varer å handle"
          />
          {loaderData.alreadyCheckedItems.length > 0 ? (
            <details className={storeModeSectionCardClass}>
              <summary className="cursor-pointer list-none text-lg font-semibold tracking-tight text-stone-950 marker:content-none [&::-webkit-details-marker]:hidden">
                Allerede krysset av
                <span className="ml-2 text-sm font-medium text-stone-500">
                  {loaderData.alreadyCheckedItems.length} varer
                </span>
              </summary>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Disse er ikke med på lenken med mindre du huker dem av.
              </p>
              <ul className="mt-4 grid gap-2">
                {loaderData.alreadyCheckedItems.map((item) => (
                  <CurationItemRow
                    defaultSelected={false}
                    item={item}
                    key={buildShoppingShareItemSelectionKey({
                      sourceKey: item.sourceKey,
                      sourceType: item.sourceType,
                    })}
                  />
                ))}
              </ul>
            </details>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Oppretter lenke..." : "Opprett lenke"}
          </button>
        </Form>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi klarte ikke å laste deling av handlelisten.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Fant ikke listen" : title;
    message =
      typeof error.data === "string" && error.data.length > 0
        ? error.data
        : error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <main className={`${storeModePageClass} py-16`}>
      <div className={`mx-auto max-w-2xl ${storeModeSurfaceCardClass} p-8`}>
        <h1 className="text-2xl font-semibold text-stone-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{message}</p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-stone-900 px-5 py-3 text-sm font-medium text-white"
          to="/app"
        >
          Til appen
        </Link>
      </div>
    </main>
  );
}

function CurationSection({
  defaultSelected,
  emptyText,
  items,
  title,
}: {
  defaultSelected: boolean;
  emptyText: string;
  items: ShoppingShareCurationItem[];
  title: string;
}) {
  return (
    <section className={storeModeSectionCardClass}>
      <h2 className="text-lg font-semibold tracking-tight text-stone-950">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-stone-600">{emptyText}</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {items.map((item) => (
            <CurationItemRow
              defaultSelected={defaultSelected}
              item={item}
              key={buildShoppingShareItemSelectionKey({
                sourceKey: item.sourceKey,
                sourceType: item.sourceType,
              })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CurationItemRow({
  defaultSelected,
  item,
}: {
  defaultSelected: boolean;
  item: ShoppingShareCurationItem;
}) {
  const selectionKey = buildShoppingShareItemSelectionKey({
    sourceKey: item.sourceKey,
    sourceType: item.sourceType,
  });

  return (
    <li>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5">
        <input
          className="mt-1 size-4 shrink-0 accent-stone-900"
          defaultChecked={defaultSelected}
          name="item"
          type="checkbox"
          value={selectionKey}
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-stone-950">
            {item.name}
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            {[item.quantityLabel, item.category.name].filter(Boolean).join(" · ")}
          </span>
          {item.note ? (
            <span className="mt-1 block text-xs text-stone-600">{item.note}</span>
          ) : null}
        </span>
      </label>
    </li>
  );
}

function ShareUrlResult({ shareUrl }: { shareUrl: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  return (
    <section className={`${storeModeSurfaceCardClass} p-6`}>
      <h2 className="text-lg font-semibold tracking-tight text-stone-950">
        Lenken er klar
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Send denne til den som skal handle. Listen oppdateres ikke hvis du
        endrer handlelisten senere.
      </p>
      <label className="mt-4 block text-sm font-medium text-stone-700">
        Delt lenke
        <input
          className="mt-1 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none focus:border-store-accent focus:ring-4 focus:ring-store-accent-light/60"
          readOnly
          value={shareUrl}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-stone-900 px-4 py-2 text-sm font-medium text-white"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopyState("copied");
            } catch {
              setCopyState("failed");
            }
          }}
          type="button"
        >
          {copyState === "copied" ? "Kopiert" : "Kopier lenke"}
        </button>
        {canShare ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900"
            onClick={() => {
              void navigator.share({
                text: "Handleliste",
                title: "Handleliste",
                url: shareUrl,
              });
            }}
            type="button"
          >
            Del
          </button>
        ) : null}
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900"
          rel="noreferrer"
          target="_blank"
          to={new URL(shareUrl).pathname}
        >
          Åpne listen
        </Link>
      </div>
      {copyState === "failed" ? (
        <p className="mt-2 text-sm text-rose-700">
          Kunne ikke kopiere. Marker lenken og kopier manuelt.
        </p>
      ) : null}
    </section>
  );
}

function requireRouteParam(value: string | undefined, message: string) {
  if (!value) {
    throw new Response(message, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return value;
}
