import { useMemo } from "react";
import {
  redirect,
  useFetcher,
  useNavigation,
  type MetaFunction,
} from "react-router";

import { ShoppingNotePaste } from "../components/shopping-note-paste";
import { FamilyUnexpectedError } from "../components/family-page";
import { requireUser } from "../lib/auth.server";
import {
  createFamilyShoppingItem,
} from "../lib/family-shopping-write.server";
import { requireFamilyMembership } from "../lib/family.server";
import { upsertFamilyShoppingCatalogItemFromQuickAdd } from "../lib/shopping-catalog-write.server";
import {
  parseShoppingNoteReviewItems,
  pickShoppingNoteCategoryId,
  shoppingNoteMessages,
  shoppingNoteQuantityForStorage,
  type ShoppingNoteReviewItem,
} from "../lib/shopping-note";
import {
  interpretShoppingNote,
  listShoppingNoteCategories,
} from "../lib/shopping-note.server";
import { projectCreatedFamilyShoppingItem } from "../lib/shopping.server";
import { resolveQuickAddManualShoppingItemValues } from "../lib/shopping-write.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Lim inn notat | Mealplanner" },
    {
      content: "Lim inn et notat og se over varene før de legges på handlelisten.",
      name: "description",
    },
  ];
};

interface ShoppingNoteActionData {
  formError?: string;
  intent: "confirm-shopping-note" | "interpret-shopping-note";
  items?: ShoppingNoteReviewItem[];
  ok?: true;
}

export async function loader({
  params,
  request,
}: {
  params: { familyId?: string };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const membership = await requireFamilyMembership({
    familyId,
    userId: user.id,
  });
  const categories = await listShoppingNoteCategories();

  return {
    categories,
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
  params: { familyId?: string };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  await requireFamilyMembership({
    familyId,
    userId: user.id,
  });
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "interpret-shopping-note") {
    return interpretNote({
      familyId,
      note: String(formData.get("note") ?? ""),
    });
  }

  if (intent === "confirm-shopping-note") {
    return confirmNote({
      familyId,
      itemsJson: String(formData.get("items") ?? ""),
      userId: user.id,
    });
  }

  return {
    formError: "Ukjent handling.",
    intent: "interpret-shopping-note",
  } satisfies ShoppingNoteActionData;
}

export default function FamilyShoppingPasteRoute({
  actionData,
  loaderData,
}: {
  actionData?: ShoppingNoteActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const interpretFetcher = useFetcher<ShoppingNoteActionData>();
  const navigation = useNavigation();
  const interpretedItems = useMemo(() => {
    const data = interpretFetcher.data;

    if (
      data?.intent === "interpret-shopping-note" &&
      data.ok &&
      data.items
    ) {
      return data.items;
    }

    return null;
  }, [interpretFetcher.data]);

  const interpretError =
    interpretFetcher.data?.intent === "interpret-shopping-note" &&
    !interpretFetcher.data.ok
      ? interpretFetcher.data.formError
      : undefined;
  const confirmError =
    actionData?.intent === "confirm-shopping-note"
      ? actionData.formError
      : undefined;

  return (
    <ShoppingNotePaste
      categories={loaderData.categories}
      confirmError={confirmError}
      confirmPending={
        navigation.state !== "idle" &&
        navigation.formData?.get("intent") === "confirm-shopping-note"
      }
      familyId={loaderData.family.id}
      familyName={loaderData.family.name}
      interpretError={interpretError}
      interpretPending={interpretFetcher.state !== "idle"}
      onInterpret={(note) => {
        const formData = new FormData();
        formData.set("intent", "interpret-shopping-note");
        formData.set("note", note);
        interpretFetcher.submit(formData, { method: "post" });
      }}
      proposedItems={interpretedItems}
    />
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return (
    <FamilyUnexpectedError
      error={error}
      fallbackMessage="Vi klarte ikke å åpne innlimingen akkurat nå."
      notFoundTitle="Fant ikke familien"
    />
  );
}

async function interpretNote({
  familyId,
  note,
}: {
  familyId: string;
  note: string;
}) {
  const categories = await listShoppingNoteCategories();
  const interpreted = await interpretShoppingNote({
    categories,
    note,
  });

  if (!interpreted.ok) {
    return {
      formError: interpreted.error,
      intent: "interpret-shopping-note",
    } satisfies ShoppingNoteActionData;
  }

  const allowedCategoryIds = new Set(categories.map((category) => category.id));
  const items: ShoppingNoteReviewItem[] = [];

  for (const item of interpreted.items) {
    const resolved = await resolveQuickAddManualShoppingItemValues({
      familyId,
      input: {
        name: item.name,
        quantity: item.quantity ?? "",
      },
    });
    const resolverCategoryId = resolved.ok ? resolved.values.categoryId : null;
    const categoryId = pickShoppingNoteCategoryId({
      allowedCategoryIds,
      modelCategoryId: item.categoryId,
      resolverCategoryId,
    });

    if (!categoryId) {
      return {
        formError: shoppingNoteMessages.noCategoryMatch,
        intent: "interpret-shopping-note",
      } satisfies ShoppingNoteActionData;
    }

    const name = resolved.ok ? resolved.values.name : item.name;
    const resolvedIngredientId =
      resolved.ok && "resolvedIngredientId" in resolved
        ? resolved.resolvedIngredientId?.trim() || null
        : null;

    items.push({
      categoryId,
      name,
      quantity: item.quantity,
      resolvedIngredientId,
      resolvedName: name,
    });
  }

  return {
    intent: "interpret-shopping-note",
    items,
    ok: true,
  } satisfies ShoppingNoteActionData;
}

async function confirmNote({
  familyId,
  itemsJson,
  userId,
}: {
  familyId: string;
  itemsJson: string;
  userId: string;
}) {
  const categories = await listShoppingNoteCategories();
  let rawItems: unknown;

  try {
    rawItems = JSON.parse(itemsJson);
  } catch {
    return {
      formError: shoppingNoteMessages.badJson,
      intent: "confirm-shopping-note",
    } satisfies ShoppingNoteActionData;
  }

  const parsed = parseShoppingNoteReviewItems(
    rawItems,
    new Set(categories.map((category) => category.id)),
  );

  if (!parsed.ok) {
    return {
      formError: parsed.error,
      intent: "confirm-shopping-note",
    } satisfies ShoppingNoteActionData;
  }

  try {
    for (const item of parsed.items) {
      const created = await createFamilyShoppingItem({
        familyId,
        userId,
        values: {
          categoryId: item.categoryId,
          name: item.name,
          note: "",
          preferredStoreId: "",
          quantity: shoppingNoteQuantityForStorage(item.quantity),
        },
      });

      if (created.status !== "CREATED") {
        return {
          formError: shoppingNoteMessages.confirmFailed,
          intent: "confirm-shopping-note",
        } satisfies ShoppingNoteActionData;
      }

      const projected = await projectCreatedFamilyShoppingItem({
        familyId,
        familyItemId: created.familyItemId,
      });

      if (!projected) {
        return {
          formError: shoppingNoteMessages.confirmFailed,
          intent: "confirm-shopping-note",
        } satisfies ShoppingNoteActionData;
      }

      const keepRegisterLink =
        item.resolvedIngredientId !== null &&
        item.name.trim() === item.resolvedName.trim();

      await upsertFamilyShoppingCatalogItemFromQuickAdd({
        familyId,
        ingredientId: keepRegisterLink
          ? item.resolvedIngredientId ?? undefined
          : undefined,
        item: projected,
      });
    }
  } catch {
    return {
      formError: shoppingNoteMessages.confirmFailed,
      intent: "confirm-shopping-note",
    } satisfies ShoppingNoteActionData;
  }

  return redirect(
    `/families/${familyId}/store-mode?${new URLSearchParams({
      notice: "shopping-note-items-added",
    })}`,
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
