export interface RecipePickerCardRecipe {
  defaultServings: number | null;
  description: string | null;
  id: string;
  imageUrl?: string | null;
  prepMinutes: number | null;
  tags: string[];
  title: string;
}

export interface RecipePickerCardFreezerItem {
  id: string;
  label: string;
  note: string | null;
  quantity: number;
}

export function RecipePickerCard({
  freezerItem,
  onSelect,
  recipe,
  selected = false,
}: {
  freezerItem?: RecipePickerCardFreezerItem;
  onSelect: () => void;
  recipe?: RecipePickerCardRecipe;
  selected?: boolean;
}) {
  const title = recipe?.title ?? freezerItem?.label ?? "";
  const imageUrl = recipe?.imageUrl ?? null;
  const tags = recipe?.tags ?? [];
  const visibleTags = tags.slice(0, 3);
  const overflowTagCount = Math.max(0, tags.length - visibleTags.length);

  return (
    <button
      aria-pressed={selected}
      className={
        selected
          ? "flex w-full min-w-0 items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-left transition hover:bg-emerald-100"
          : "flex w-full min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:bg-slate-50"
      }
      onClick={onSelect}
      type="button"
    >
      <RecipePickerMedia imageUrl={imageUrl} title={title} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
        {recipe ? (
          <p className="mt-0.5 text-xs text-slate-500">
            {recipe.prepMinutes ?? "?"} min · {recipe.defaultServings ?? "?"}{" "}
            personer
          </p>
        ) : freezerItem ? (
          <p className="mt-0.5 text-xs text-slate-500">
            Fryser · {freezerItem.quantity} igjen
          </p>
        ) : null}
        {visibleTags.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
              >
                {tag}
              </span>
            ))}
            {overflowTagCount > 0 ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                +{overflowTagCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function RecipePickerMedia({
  imageUrl,
  size = "md",
  title,
}: {
  imageUrl?: string | null;
  size?: "sm" | "md";
  title: string;
}) {
  const dimension = size === "sm" ? "h-8 w-8" : "h-14 w-14";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const initial = title.trim().charAt(0).toUpperCase() || "?";

  if (imageUrl) {
    return (
      <img
        alt=""
        className={`${dimension} shrink-0 rounded-xl object-cover`}
        loading="lazy"
        src={imageUrl}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-500 ${textSize}`}
    >
      {initial}
    </span>
  );
}
