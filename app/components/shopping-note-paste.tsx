import { useEffect, useState } from "react";
import { Form, Link } from "react-router";

import {
  FamilyFormErrorBanner,
  FamilyPageHeader,
  familyBandLinkClassName,
} from "./family-page";
import {
  SHOPPING_NOTE_MAX_LENGTH,
  validateShoppingNoteLength,
  type ShoppingNoteCategory,
  type ShoppingNoteReviewItem,
} from "../lib/shopping-note";

interface ShoppingNotePasteProps {
  categories: ShoppingNoteCategory[];
  confirmError?: string;
  confirmPending: boolean;
  familyId: string;
  familyName: string;
  interpretError?: string;
  interpretPending: boolean;
  onInterpret: (note: string) => void;
  proposedItems: ShoppingNoteReviewItem[] | null;
}

interface EditableShoppingNoteItem extends ShoppingNoteReviewItem {
  key: string;
}

export function ShoppingNotePaste({
  categories,
  confirmError,
  confirmPending,
  familyId,
  familyName,
  interpretError,
  interpretPending,
  onInterpret,
  proposedItems,
}: ShoppingNotePasteProps) {
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<EditableShoppingNoteItem[]>(
    [],
  );
  const [showReview, setShowReview] = useState(false);
  const shoppingPath = `/families/${familyId}/store-mode`;
  const pasteError = localError ?? interpretError;

  useEffect(() => {
    if (!proposedItems) {
      return;
    }

    setReviewItems(
      proposedItems.map((item, index) => ({
        ...item,
        key: `${index}-${item.resolvedName}-${item.categoryId}`,
      })),
    );
    setShowReview(true);
    setLocalError(null);
  }, [proposedItems]);

  const confirmItems = reviewItems.map((item) => ({
    categoryId: item.categoryId,
    name: item.name,
    quantity: item.quantity,
    resolvedIngredientId: item.resolvedIngredientId,
    resolvedName: item.resolvedName,
  }));
  const confirmBlocked =
    confirmPending ||
    reviewItems.length === 0 ||
    reviewItems.some((item) => !item.name.trim() || !item.categoryId);

  function updateReviewItem(
    key: string,
    patch: Partial<
      Pick<EditableShoppingNoteItem, "categoryId" | "name" | "quantity">
    >,
  ) {
    setReviewItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeReviewItem(key: string) {
    setReviewItems((current) => current.filter((item) => item.key !== key));
  }

  return (
    <main className="min-h-screen bg-page px-4 py-8 text-ink lg:py-12">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <FamilyPageHeader
          actions={
            <Link className={familyBandLinkClassName} to={shoppingPath}>
              Tilbake til listen
            </Link>
          }
          description="Lim inn et notat fra en annen app. Vi foreslår varene, og du ser over dem før de legges til."
          kicker="Lim inn notat"
          title={familyName}
          titleClassName="mt-4 text-3xl font-semibold tracking-tight lg:text-4xl"
        />

        <article className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
          {showReview ? (
            <Form method="post">
              <input name="intent" type="hidden" value="confirm-shopping-note" />
              <input
                name="items"
                type="hidden"
                value={JSON.stringify(confirmItems)}
              />
              <h2 className="text-lg font-semibold text-ink">Se over varene</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Endre navn, mengde eller kategori, eller fjern en rad, før du
                legger dem til listen.
              </p>

              {confirmError ? (
                <div className="mt-6">
                  <FamilyFormErrorBanner
                    message={confirmError}
                    title="Kunne ikke legge til varene"
                  />
                </div>
              ) : null}

              <div className="mt-6 grid gap-4">
                {reviewItems.map((item) => (
                  <div
                    className="grid gap-3 rounded-2xl border border-line bg-page p-4"
                    key={item.key}
                  >
                    <label className="block text-sm font-medium text-muted">
                      Varenavn
                      <input
                        className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                        onChange={(event) =>
                          updateReviewItem(item.key, {
                            name: event.target.value,
                          })
                        }
                        type="text"
                        value={item.name}
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                      <label className="block text-sm font-medium text-muted">
                        Mengde
                        <input
                          className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                          onChange={(event) =>
                            updateReviewItem(item.key, {
                              quantity: event.target.value.trim()
                                ? event.target.value
                                : null,
                            })
                          }
                          type="text"
                          value={item.quantity ?? ""}
                        />
                      </label>
                      <label className="block text-sm font-medium text-muted">
                        Kategori
                        <select
                          className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                          onChange={(event) =>
                            updateReviewItem(item.key, {
                              categoryId: event.target.value,
                            })
                          }
                          value={item.categoryId}
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button
                      className="justify-self-start text-sm font-medium text-muted underline-offset-4 hover:underline"
                      onClick={() => removeReviewItem(item.key)}
                      type="button"
                    >
                      Fjern
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  className="rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={confirmBlocked}
                  type="submit"
                >
                  {confirmPending ? "Legger til..." : "Legg til på listen"}
                </button>
                <button
                  className="text-sm font-medium text-muted underline-offset-4 hover:underline"
                  onClick={() => setShowReview(false)}
                  type="button"
                >
                  Tilbake til notatet
                </button>
                <Link
                  className="text-sm font-medium text-muted underline-offset-4 hover:underline"
                  to={shoppingPath}
                >
                  Avbryt
                </Link>
              </div>
            </Form>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-ink">Notatet</h2>
              <label className="mt-6 block text-sm font-medium text-muted">
                Notat
                <textarea
                  className="mt-2 min-h-48 w-full rounded-2xl border border-line bg-page px-4 py-3 text-base text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                  maxLength={SHOPPING_NOTE_MAX_LENGTH}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setLocalError(null);
                  }}
                  value={note}
                />
              </label>

              {pasteError ? (
                <div className="mt-6">
                  <FamilyFormErrorBanner
                    message={pasteError}
                    title="Kunne ikke tolke notatet"
                  />
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  className="rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={interpretPending}
                  onClick={() => {
                    const error = validateShoppingNoteLength(note);

                    if (error) {
                      setLocalError(error);
                      return;
                    }

                    setLocalError(null);
                    onInterpret(note);
                  }}
                  type="button"
                >
                  {interpretPending ? "Tolker notatet..." : "Tolke notatet"}
                </button>
                <Link
                  className="text-sm font-medium text-muted underline-offset-4 hover:underline"
                  to={shoppingPath}
                >
                  Avbryt
                </Link>
              </div>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}
