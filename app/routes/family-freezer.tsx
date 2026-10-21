import { Form, Link, useNavigation } from "react-router";

import {
  FamilyFormErrorBanner,
  FamilyLoadError,
  FamilyNoticeBanner,
  FamilyPageHeader,
  familyBandLinkClassName,
  familyBandPrimaryLinkClassName,
  familyPageMeta,
} from "../components/family-page";
import { listFamilyFreezerItems } from "../lib/freezer.server";
import {
  addFamilyFreezerItem,
  removeFamilyFreezerItem,
  updateFamilyFreezerItem,
  type FamilyFreezerItemFieldErrors,
  type FamilyFreezerItemValues,
} from "../lib/freezer-write.server";
import {
  requireFamilyRouteUser,
  readFamilyRouteForm,
  type FamilyRouteArgs,
} from "../lib/family-route.server";

type FreezerNotice =
  | "freezer-item-added"
  | "freezer-item-removed"
  | "freezer-item-updated";

type FreezerIntent =
  | "add-freezer-item"
  | "remove-freezer-item"
  | "update-freezer-item";

interface FreezerActionData {
  addFieldErrors?: FamilyFreezerItemFieldErrors;
  addValues?: FamilyFreezerItemValues;
  formError?: string;
  intent?: FreezerIntent;
  targetFreezerItemId?: string;
  updateFieldErrors?: FamilyFreezerItemFieldErrors;
  updateValues?: FamilyFreezerItemValues;
}

interface FamilyFreezerRouteProps {
  actionData?: FreezerActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta = familyPageMeta(
  "Fryser | Mealplanner",
  "Administrer meal-prepped middager som ligger i fryseren og hold oversikt over porsjoner.",
);

export async function loader({ params, request }: FamilyRouteArgs) {
  const { familyId, user } = await requireFamilyRouteUser({ params, request });
  const result = await listFamilyFreezerItems({
    familyId,
    userId: user.id,
  });

  return {
    family: result.family,
    freezerItems: result.freezerItems,
    notice: getFreezerNotice(request),
    userRole: result.userRole,
  };
}

export async function action({ params, request }: FamilyRouteArgs) {
  const { familyId, formData, intent, user } = await readFamilyRouteForm({
    params,
    request,
  });

  if (intent === "add-freezer-item") {
    const result = await addFamilyFreezerItem({
      familyId,
      userId: user.id,
      values: parseFreezerItemValues(formData),
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        addFieldErrors: result.fieldErrors,
        addValues: result.values,
        intent,
      } satisfies FreezerActionData;
    }

    return buildFreezerRedirect({
      familyId,
      notice: "freezer-item-added",
      request,
    });
  }

  if (intent === "update-freezer-item") {
    const freezerItemId = String(formData.get("freezerItemId") ?? "").trim();

    if (!freezerItemId) {
      return {
        formError: "Fant ikke fryserposten som skulle oppdateres.",
        intent,
      } satisfies FreezerActionData;
    }

    const result = await updateFamilyFreezerItem({
      familyId,
      freezerItemId,
      userId: user.id,
      values: parseFreezerItemValues(formData),
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke fryserposten som skulle oppdateres.",
        intent,
        targetFreezerItemId: freezerItemId,
      } satisfies FreezerActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        intent,
        targetFreezerItemId: freezerItemId,
        updateFieldErrors: result.fieldErrors,
        updateValues: result.values,
      } satisfies FreezerActionData;
    }

    return buildFreezerRedirect({
      familyId,
      notice: "freezer-item-updated",
      request,
    });
  }

  if (intent === "remove-freezer-item") {
    const freezerItemId = String(formData.get("freezerItemId") ?? "").trim();

    if (!freezerItemId) {
      return {
        formError: "Fant ikke fryserposten som skulle fjernes.",
        intent,
      } satisfies FreezerActionData;
    }

    const result = await removeFamilyFreezerItem({
      familyId,
      freezerItemId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke fryserposten som skulle fjernes.",
        intent,
        targetFreezerItemId: freezerItemId,
      } satisfies FreezerActionData;
    }

    return buildFreezerRedirect({
      familyId,
      notice: "freezer-item-removed",
      request,
    });
  }

  return {
    formError: "Ukjent handling.",
  } satisfies FreezerActionData;
}

export default function FamilyFreezerRoute({
  actionData,
  loaderData,
}: FamilyFreezerRouteProps) {
  const navigation = useNavigation();
  const noticeContent = loaderData.notice
    ? getFreezerNoticeContent(loaderData.notice)
    : null;
  const pendingIntent = navigation.formData?.get("intent");
  const addValues =
    actionData?.intent === "add-freezer-item" && actionData.addValues
      ? actionData.addValues
      : {
          label: "",
          note: "",
          quantity: "",
        };
  const pendingFreezerItemId = String(
    navigation.formData?.get("freezerItemId") ?? "",
  );
  const isPendingFreezer =
    navigation.state !== "idle" && navigation.formData != null;
  const displayFreezerItems = (() => {
    if (!isPendingFreezer || !navigation.formData) {
      return loaderData.freezerItems;
    }

    if (pendingIntent === "remove-freezer-item" && pendingFreezerItemId) {
      return loaderData.freezerItems.filter(
        (item) => item.id !== pendingFreezerItemId,
      );
    }

    if (pendingIntent === "update-freezer-item" && pendingFreezerItemId) {
      return loaderData.freezerItems.map((item) =>
        item.id === pendingFreezerItemId
          ? {
              ...item,
              label:
                String(navigation.formData?.get("label") ?? item.label).trim() ||
                item.label,
              note: String(navigation.formData?.get("note") ?? "") || null,
              quantity: Number(
                navigation.formData?.get("quantity") ?? item.quantity,
              ),
            }
          : item,
      );
    }

    if (pendingIntent === "add-freezer-item") {
      const label = String(navigation.formData.get("label") ?? "").trim();

      if (!label) {
        return loaderData.freezerItems;
      }

      return [
        {
          id: "optimistic:pending-add",
          label,
          note: String(navigation.formData.get("note") ?? "") || null,
          quantity: Number(navigation.formData.get("quantity") ?? 0),
        },
        ...loaderData.freezerItems,
      ];
    }

    return loaderData.freezerItems;
  })();

  return (
    <main className="min-h-screen bg-page px-4 py-12 text-ink">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <FamilyPageHeader
          actions={
            <>
              <Link
                className={familyBandPrimaryLinkClassName}
                to={`/families/${loaderData.family.id}/meal-plans`}
              >
                Åpne ukeplaner
              </Link>
              <Link
                className={familyBandLinkClassName}
                to={`/families/${loaderData.family.id}`}
              >
                Tilbake til familie
              </Link>
            </>
          }
          description="Registrer meal-prepped middager som ligger i fryseren, og bruk dem når dere planlegger uken."
          kicker="Fryser"
          title={loaderData.family.name}
        />

        {noticeContent ? (
          <FamilyNoticeBanner
            description={noticeContent.description}
            title={noticeContent.title}
          />
        ) : null}

        {actionData?.formError ? (
          <FamilyFormErrorBanner
            message={actionData.formError}
            title="Kunne ikke oppdatere fryseren"
          />
        ) : null}

        <section className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-ink">
              Legg til fryserrett
            </h2>
            <p className="text-sm leading-6 text-muted">
              Gi retten et navn og registrer hvor mange porsjoner som ligger i
              fryseren.
            </p>
          </div>

          <Form className="mt-6 grid gap-4 sm:grid-cols-2" method="post">
            <input name="intent" type="hidden" value="add-freezer-item" />
            <label className="block text-sm font-medium text-muted sm:col-span-2">
              Navn
              <input
                className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                defaultValue={addValues.label}
                name="label"
                placeholder="For eksempel Chili con carne"
                type="text"
              />
            </label>
            {actionData?.addFieldErrors?.label ? (
              <p className="text-sm text-rose-600 sm:col-span-2">
                {actionData.addFieldErrors.label}
              </p>
            ) : null}
            <label className="block text-sm font-medium text-muted">
              Antall porsjoner
              <input
                className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                defaultValue={addValues.quantity}
                inputMode="numeric"
                min="0"
                name="quantity"
                placeholder="4"
                type="number"
              />
            </label>
            {actionData?.addFieldErrors?.quantity ? (
              <p className="text-sm text-rose-600">
                {actionData.addFieldErrors.quantity}
              </p>
            ) : null}
            <label className="block text-sm font-medium text-muted sm:col-span-2">
              Notat (valgfritt)
              <input
                className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                defaultValue={addValues.note}
                name="note"
                placeholder="For eksempel Boks 2, varm på lav varme"
                type="text"
              />
            </label>
            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
              disabled={
                navigation.state !== "idle" &&
                pendingIntent === "add-freezer-item"
              }
              type="submit"
            >
              {navigation.state !== "idle" &&
              pendingIntent === "add-freezer-item"
                ? "Legger til..."
                : "Legg til fryserrett"}
            </button>
          </Form>
        </section>

        <section className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-ink">
              Fryserbeholdning
            </h2>
            <p className="text-sm leading-6 text-muted">
              {displayFreezerItems.length === 0
                ? "Ingen fryserretter er registrert ennå."
                : `${displayFreezerItems.length} fryserretter er registrert.`}
            </p>
          </div>

          {displayFreezerItems.length > 0 ? (
            <ul className="mt-6 grid gap-4">
              {displayFreezerItems.map((item) => {
                const isUpdating =
                  navigation.state !== "idle" &&
                  pendingIntent === "update-freezer-item" &&
                  pendingFreezerItemId === item.id;
                const isRemoving =
                  navigation.state !== "idle" &&
                  pendingIntent === "remove-freezer-item" &&
                  pendingFreezerItemId === item.id;
                const updateValues =
                  actionData?.intent === "update-freezer-item" &&
                  actionData.targetFreezerItemId === item.id &&
                  actionData.updateValues
                    ? actionData.updateValues
                    : {
                        label: item.label,
                        note: item.note ?? "",
                        quantity: String(item.quantity),
                      };
                const updateFieldErrors =
                  actionData?.intent === "update-freezer-item" &&
                  actionData.targetFreezerItemId === item.id
                    ? actionData.updateFieldErrors
                    : undefined;

                return (
                  <li
                    key={item.id}
                    className="rounded-[24px] border border-line bg-page p-5"
                  >
                    <Form className="grid gap-4" method="post">
                      <input
                        name="intent"
                        type="hidden"
                        value="update-freezer-item"
                      />
                      <input
                        name="freezerItemId"
                        type="hidden"
                        value={item.id}
                      />
                      <label className="block text-sm font-medium text-muted">
                        Navn
                        <input
                          className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                          defaultValue={updateValues.label}
                          name="label"
                          type="text"
                        />
                      </label>
                      {updateFieldErrors?.label ? (
                        <p className="text-sm text-rose-600">
                          {updateFieldErrors.label}
                        </p>
                      ) : null}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-muted">
                          Antall porsjoner
                          <input
                            className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                            defaultValue={updateValues.quantity}
                            inputMode="numeric"
                            min="0"
                            name="quantity"
                            type="number"
                          />
                        </label>
                        <label className="block text-sm font-medium text-muted">
                          Notat
                          <input
                            className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                            defaultValue={updateValues.note}
                            name="note"
                            type="text"
                          />
                        </label>
                      </div>
                      {updateFieldErrors?.quantity ? (
                        <p className="text-sm text-rose-600">
                          {updateFieldErrors.quantity}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <button
                          className="rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isUpdating || isRemoving}
                          type="submit"
                        >
                          {isUpdating ? "Lagrer..." : "Lagre endringer"}
                        </button>
                      </div>
                    </Form>
                    <Form className="mt-3" method="post">
                      <input
                        name="intent"
                        type="hidden"
                        value="remove-freezer-item"
                      />
                      <input
                        name="freezerItemId"
                        type="hidden"
                        value={item.id}
                      />
                      <button
                        className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUpdating || isRemoving}
                        type="submit"
                      >
                        {isRemoving ? "Fjerner..." : "Fjern"}
                      </button>
                    </Form>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return (
    <FamilyLoadError
      error={error}
      fallbackMessage="Noe gikk galt under lasting av fryseren."
    />
  );
}

function parseFreezerItemValues(formData: FormData): FamilyFreezerItemValues {
  return {
    label: String(formData.get("label") ?? ""),
    note: String(formData.get("note") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
  };
}

function getFreezerNotice(request: Request): FreezerNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "freezer-item-added" ||
    notice === "freezer-item-updated" ||
    notice === "freezer-item-removed"
  ) {
    return notice;
  }

  return null;
}

function getFreezerNoticeContent(notice: FreezerNotice) {
  switch (notice) {
    case "freezer-item-added":
      return {
        description: "Fryserretten ble lagt til.",
        title: "Lagret",
      };
    case "freezer-item-updated":
      return {
        description: "Fryserposten ble oppdatert.",
        title: "Oppdatert",
      };
    case "freezer-item-removed":
      return {
        description: "Fryserposten ble fjernet.",
        title: "Fjernet",
      };
  }
}

function buildFreezerRedirect({
  familyId,
  notice,
  request,
}: {
  familyId: string;
  notice: FreezerNotice;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/freezer`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}
