import {
  Form,
  Link,
  isRouteErrorResponse,
  useNavigation,
  type MetaFunction,
} from "react-router";

import { requireUser } from "../lib/auth.server";
import { listFamilyShoppingCatalogItems } from "../lib/shopping-catalog.server";
import {
  addFamilyShoppingCatalogItem,
  deleteFamilyShoppingCatalogItem,
  updateFamilyShoppingCatalogItem,
  type FamilyShoppingCatalogItemFieldErrors,
  type FamilyShoppingCatalogItemValues,
} from "../lib/shopping-catalog-write.server";
import { listIngredientCategories } from "../lib/store.server";

type CatalogNotice =
  | "catalog-item-added"
  | "catalog-item-removed"
  | "catalog-item-updated";

type CatalogIntent =
  | "add-catalog-item"
  | "remove-catalog-item"
  | "update-catalog-item";

interface CatalogActionData {
  addFieldErrors?: FamilyShoppingCatalogItemFieldErrors;
  addValues?: FamilyShoppingCatalogItemValues;
  formError?: string;
  intent?: CatalogIntent;
  targetCatalogItemId?: string;
  updateFieldErrors?: FamilyShoppingCatalogItemFieldErrors;
  updateValues?: FamilyShoppingCatalogItemValues;
}

interface FamilyShoppingCatalogRouteProps {
  actionData?: CatalogActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Handlevarer | Mealplanner" },
    {
      name: "description",
      content:
        "Administrer familiens gjenbrukbare varenavn for hurtig utfylling i handlelisten.",
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
  const [result, categories] = await Promise.all([
    listFamilyShoppingCatalogItems({
      familyId,
      userId: user.id,
    }),
    listIngredientCategories(),
  ]);

  return {
    catalogItems: result.catalogItems,
    categories,
    family: result.family,
    notice: getCatalogNotice(request),
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

  if (intent === "add-catalog-item") {
    const result = await addFamilyShoppingCatalogItem({
      familyId,
      userId: user.id,
      values: parseCatalogItemValues(formData),
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        addFieldErrors: result.fieldErrors,
        addValues: result.values,
        intent,
      } satisfies CatalogActionData;
    }

    return buildCatalogRedirect({
      familyId,
      notice: "catalog-item-added",
      request,
    });
  }

  if (intent === "update-catalog-item") {
    const catalogItemId = String(formData.get("catalogItemId") ?? "").trim();

    if (!catalogItemId) {
      return {
        formError: "Fant ikke varen som skulle oppdateres.",
        intent,
      } satisfies CatalogActionData;
    }

    const result = await updateFamilyShoppingCatalogItem({
      catalogItemId,
      familyId,
      userId: user.id,
      values: parseCatalogItemValues(formData),
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke varen som skulle oppdateres.",
        intent,
        targetCatalogItemId: catalogItemId,
      } satisfies CatalogActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        intent,
        targetCatalogItemId: catalogItemId,
        updateFieldErrors: result.fieldErrors,
        updateValues: result.values,
      } satisfies CatalogActionData;
    }

    return buildCatalogRedirect({
      familyId,
      notice: "catalog-item-updated",
      request,
    });
  }

  if (intent === "remove-catalog-item") {
    const catalogItemId = String(formData.get("catalogItemId") ?? "").trim();

    if (!catalogItemId) {
      return {
        formError: "Fant ikke varen som skulle fjernes.",
        intent,
      } satisfies CatalogActionData;
    }

    const result = await deleteFamilyShoppingCatalogItem({
      catalogItemId,
      familyId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke varen som skulle fjernes.",
        intent,
        targetCatalogItemId: catalogItemId,
      } satisfies CatalogActionData;
    }

    return buildCatalogRedirect({
      familyId,
      notice: "catalog-item-removed",
      request,
    });
  }

  return {
    formError: "Ukjent handling.",
  } satisfies CatalogActionData;
}

export default function FamilyShoppingCatalogRoute({
  actionData,
  loaderData,
}: FamilyShoppingCatalogRouteProps) {
  const navigation = useNavigation();
  const noticeContent = loaderData.notice
    ? getCatalogNoticeContent(loaderData.notice)
    : null;
  const pendingIntent = navigation.formData?.get("intent");
  const addValues =
    actionData?.intent === "add-catalog-item" && actionData.addValues
      ? actionData.addValues
      : {
          categoryId: "",
          name: "",
          quantity: "",
        };
  const pendingCatalogItemId = String(
    navigation.formData?.get("catalogItemId") ?? "",
  );
  const isPendingCatalog =
    navigation.state !== "idle" && navigation.formData != null;
  const displayCatalogItems = (() => {
    if (!isPendingCatalog || !navigation.formData) {
      return loaderData.catalogItems;
    }

    if (pendingIntent === "remove-catalog-item" && pendingCatalogItemId) {
      return loaderData.catalogItems.filter(
        (item) => item.id !== pendingCatalogItemId,
      );
    }

    if (pendingIntent === "update-catalog-item" && pendingCatalogItemId) {
      const name = String(navigation.formData.get("name") ?? "").trim();
      const categoryId = String(
        navigation.formData.get("categoryId") ?? "",
      ).trim();
      const quantity = String(navigation.formData.get("quantity") ?? "").trim();
      const category =
        loaderData.categories.find((entry) => entry.id === categoryId) ?? null;

      return loaderData.catalogItems.map((item) =>
        item.id === pendingCatalogItemId
          ? {
              ...item,
              defaultCategory: category ?? item.defaultCategory,
              defaultCategoryId: categoryId || item.defaultCategoryId,
              defaultQuantity: quantity || null,
              displayName: name || item.displayName,
            }
          : item,
      );
    }

    if (pendingIntent === "add-catalog-item") {
      const name = String(navigation.formData.get("name") ?? "").trim();

      if (!name) {
        return loaderData.catalogItems;
      }

      const categoryId = String(
        navigation.formData.get("categoryId") ?? "",
      ).trim();
      const quantity = String(navigation.formData.get("quantity") ?? "").trim();
      const category =
        loaderData.categories.find((entry) => entry.id === categoryId) ?? {
          displayName: "",
          id: categoryId,
        };

      return [
        {
          defaultCategory: category,
          defaultCategoryId: categoryId,
          defaultQuantity: quantity || null,
          displayName: name,
          id: "optimistic:pending-add",
          lastUsedAt: new Date(),
          nameNormalized: name.toLowerCase(),
        },
        ...loaderData.catalogItems,
      ];
    }

    return loaderData.catalogItems;
  })();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Handlevarer
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {loaderData.family.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Gjenbrukbare varenavn som ikke kommer fra oppskrifter, for
                eksempel husholdningsvarer. Når dere legger til et nytt navn i
                handlelisten, lagres det her så det kan søkes opp neste uke.
                Dette er ikke det samme som basisvarer, som holdes utenfor
                handlelisten fordi dere vanligvis har dem hjemme.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                to={`/families/${loaderData.family.id}/store-mode`}
              >
                Åpne handleliste
              </Link>
              <Link
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                to={`/families/${loaderData.family.id}/stock-ingredients`}
              >
                Basisvarer
              </Link>
            </div>
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
              Kunne ikke oppdatere handlevarene
            </h2>
            <p className="mt-2 text-sm leading-6">{actionData.formError}</p>
          </section>
        ) : null}

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-slate-950">
              Legg til handlevare
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              Gi varen et navn, en standardmengde og en kategori. Den dukker opp
              når dere skriver i hurtigfeltet på handlelisten.
            </p>
          </div>

          <Form className="mt-6 grid gap-4 sm:grid-cols-2" method="post">
            <input name="intent" type="hidden" value="add-catalog-item" />
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Navn
              <input
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                defaultValue={addValues.name}
                name="name"
                placeholder="For eksempel tørkerull"
                type="text"
              />
            </label>
            {actionData?.addFieldErrors?.name ? (
              <p className="text-sm text-rose-600 sm:col-span-2">
                {actionData.addFieldErrors.name}
              </p>
            ) : null}
            <label className="block text-sm font-medium text-slate-700">
              Standardmengde
              <input
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                defaultValue={addValues.quantity}
                name="quantity"
                placeholder="For eksempel 1 pk"
                type="text"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Kategori
              <select
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                defaultValue={addValues.categoryId}
                name="categoryId"
              >
                <option value="">Velg kategori</option>
                {loaderData.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.displayName}
                  </option>
                ))}
              </select>
            </label>
            {actionData?.addFieldErrors?.categoryId ? (
              <p className="text-sm text-rose-600 sm:col-span-2">
                {actionData.addFieldErrors.categoryId}
              </p>
            ) : null}
            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:col-span-2"
              disabled={
                navigation.state !== "idle" &&
                pendingIntent === "add-catalog-item"
              }
              type="submit"
            >
              {navigation.state !== "idle" &&
              pendingIntent === "add-catalog-item"
                ? "Legger til..."
                : "Legg til handlevare"}
            </button>
          </Form>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-slate-950">
              Familiens handlevarer
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              {displayCatalogItems.length === 0
                ? "Ingen handlevarer er registrert ennå. De opprettes også automatisk når dere skriver inn et nytt navn i handlelisten."
                : `${displayCatalogItems.length} handlevarer er registrert.`}
            </p>
          </div>

          {displayCatalogItems.length > 0 ? (
            <ul className="mt-6 grid gap-4">
              {displayCatalogItems.map((item) => {
                const isUpdating =
                  navigation.state !== "idle" &&
                  pendingIntent === "update-catalog-item" &&
                  pendingCatalogItemId === item.id;
                const isRemoving =
                  navigation.state !== "idle" &&
                  pendingIntent === "remove-catalog-item" &&
                  pendingCatalogItemId === item.id;
                const updateValues =
                  actionData?.intent === "update-catalog-item" &&
                  actionData.targetCatalogItemId === item.id &&
                  actionData.updateValues
                    ? actionData.updateValues
                    : {
                        categoryId: item.defaultCategoryId,
                        name: item.displayName,
                        quantity: item.defaultQuantity ?? "",
                      };
                const updateFieldErrors =
                  actionData?.intent === "update-catalog-item" &&
                  actionData.targetCatalogItemId === item.id
                    ? actionData.updateFieldErrors
                    : undefined;

                return (
                  <li
                    key={item.id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                  >
                    <Form className="grid gap-4" method="post">
                      <input
                        name="intent"
                        type="hidden"
                        value="update-catalog-item"
                      />
                      <input
                        name="catalogItemId"
                        type="hidden"
                        value={item.id}
                      />
                      <label className="block text-sm font-medium text-slate-700">
                        Navn
                        <input
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                          defaultValue={updateValues.name}
                          name="name"
                          type="text"
                        />
                      </label>
                      {updateFieldErrors?.name ? (
                        <p className="text-sm text-rose-600">
                          {updateFieldErrors.name}
                        </p>
                      ) : null}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Standardmengde
                          <input
                            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            defaultValue={updateValues.quantity}
                            name="quantity"
                            type="text"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          Kategori
                          <select
                            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            defaultValue={updateValues.categoryId}
                            name="categoryId"
                          >
                            <option value="">Velg kategori</option>
                            {loaderData.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.displayName}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {updateFieldErrors?.categoryId ? (
                        <p className="text-sm text-rose-600">
                          {updateFieldErrors.categoryId}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <button
                          className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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
                        value="remove-catalog-item"
                      />
                      <input
                        name="catalogItemId"
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
  if (isRouteErrorResponse(error)) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold text-slate-950">
            {error.status} {error.statusText}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {typeof error.data === "string"
              ? error.data
              : "Noe gikk galt under lasting av handlevarene."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-950">Uventet feil</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Noe gikk galt under lasting av handlevarene.
        </p>
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

function parseCatalogItemValues(
  formData: FormData,
): FamilyShoppingCatalogItemValues {
  return {
    categoryId: String(formData.get("categoryId") ?? ""),
    name: String(formData.get("name") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
  };
}

function getCatalogNotice(request: Request): CatalogNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "catalog-item-added" ||
    notice === "catalog-item-updated" ||
    notice === "catalog-item-removed"
  ) {
    return notice;
  }

  return null;
}

function getCatalogNoticeContent(notice: CatalogNotice) {
  switch (notice) {
    case "catalog-item-added":
      return {
        description: "Handlevaren ble lagt til.",
        title: "Lagret",
      };
    case "catalog-item-updated":
      return {
        description: "Handlevaren ble oppdatert.",
        title: "Oppdatert",
      };
    case "catalog-item-removed":
      return {
        description: "Handlevaren ble fjernet.",
        title: "Fjernet",
      };
  }
}

function buildCatalogRedirect({
  familyId,
  notice,
  request,
}: {
  familyId: string;
  notice: CatalogNotice;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/shopping-catalog`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}
