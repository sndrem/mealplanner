import { useEffect, useId, useMemo, useState } from "react";

import {
  applyRecipeReminderPreset,
  buildFamilyRecipeUrl,
  canLaunchRecipeReminderShortcut,
  createRecipeReminder,
  formatLocalDateInput,
  formatLocalTimeInput,
  getRecipeReminderPlatformSupport,
  parseLocalDateTime,
  RECIPE_REMINDER_PRESETS,
  RECIPE_REMINDER_SHORTCUT_NAME,
  type RecipeReminderPresetId,
  type RecipeReminderSuggestion,
} from "../lib/recipe-reminder";

export function RecipeReminderModal({
  familyId,
  onClose,
  recipeId,
  recipeTitle,
  suggestions = [],
}: {
  familyId: string;
  onClose: () => void;
  recipeId: string;
  recipeTitle: string;
  suggestions?: RecipeReminderSuggestion[];
}) {
  const titleId = useId();
  const defaultDueAt = useMemo(
    () => applyRecipeReminderPreset("tomorrow-morning", new Date()),
    [],
  );
  const [title, setTitle] = useState(recipeTitle);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<
    string | undefined
  >();
  const [presetId, setPresetId] = useState<RecipeReminderPresetId>(
    "tomorrow-morning",
  );
  const [date, setDate] = useState(() => formatLocalDateInput(defaultDueAt));
  const [time, setTime] = useState(() => formatLocalTimeInput(defaultDueAt));
  const [formError, setFormError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [launchMayHaveFailed, setLaunchMayHaveFailed] = useState(false);
  const [nameCopied, setNameCopied] = useState(false);

  const platformSupport = getRecipeReminderPlatformSupport({
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  });
  const canLaunch = canLaunchRecipeReminderShortcut(platformSupport);
  const dueAt = parseLocalDateTime(date, time);
  const isPastDue = Boolean(dueAt && dueAt.getTime() < Date.now());
  const canSubmit = canLaunch && title.trim().length > 0 && dueAt !== null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handlePresetClick(nextPresetId: RecipeReminderPresetId) {
    setPresetId(nextPresetId);
    setFormError(null);

    if (nextPresetId === "custom") {
      return;
    }

    const nextDueAt = applyRecipeReminderPreset(nextPresetId, new Date());
    setDate(formatLocalDateInput(nextDueAt));
    setTime(formatLocalTimeInput(nextDueAt));
  }

  function handleDateChange(value: string) {
    setDate(value);
    setPresetId("custom");
    setFormError(null);
  }

  function handleTimeChange(value: string) {
    setTime(value);
    setPresetId("custom");
    setFormError(null);
  }

  function handleSuggestionClick(suggestion: RecipeReminderSuggestion) {
    setTitle(suggestion.title);
    setSelectedSuggestionId(suggestion.id);
    setFormError(null);
  }

  function handleCreate() {
    if (!dueAt) {
      setFormError("Velg en gyldig dato og et klokkeslett.");
      return;
    }

    const result = createRecipeReminder({
      dueAt,
      recipeUrl: buildFamilyRecipeUrl({
        familyId,
        origin: window.location.origin,
        recipeId,
      }),
      suggestionId: selectedSuggestionId,
      title,
    });

    if (!result.ok) {
      setFormError(getCreateErrorMessage(result.error));
      return;
    }

    window.setTimeout(() => {
      if (!document.hidden) {
        setLaunchMayHaveFailed(true);
        setHelpOpen(true);
      }
    }, 1500);
  }

  async function handleCopyShortcutName() {
    try {
      await navigator.clipboard.writeText(RECIPE_REMINDER_SHORTCUT_NAME);
      setNameCopied(true);
    } catch {
      setNameCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h3 className="text-lg font-semibold text-slate-950" id={titleId}>
          Påminn meg
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Opprett en påminnelse i Apple Påminnelser via snarveien «
          {RECIPE_REMINDER_SHORTCUT_NAME}».
        </p>

        {platformSupport === "unsupported" ? (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950">
            Denne funksjonen fungerer i Safari på iPhone og iPad. Åpne
            oppskriften der for å sende den til Påminnelser.
          </p>
        ) : null}

        {platformSupport === "macos" ? (
          <p className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm leading-6 text-sky-950">
            Dette er laget for iPhone. macOS kan åpne Snarveier, men opplevelsen
            er best i Safari på iOS.
          </p>
        ) : null}

        {suggestions.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700">Foreslåtte påminnelser</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => {
                const selected =
                  suggestion.id != null
                    ? selectedSuggestionId === suggestion.id
                    : title === suggestion.title;

                return (
                  <button
                    className={
                      selected
                        ? "rounded-full bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-300"
                        : "rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                    }
                    key={suggestion.id ?? suggestion.title}
                    onClick={() => handleSuggestionClick(suggestion)}
                    type="button"
                  >
                    {suggestion.title}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Tekst
          <input
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            onChange={(event) => {
              setTitle(event.target.value);
              setSelectedSuggestionId(undefined);
              setFormError(null);
            }}
            type="text"
            value={title}
          />
        </label>

        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">Når</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RECIPE_REMINDER_PRESETS.map((preset) => (
              <button
                aria-pressed={presetId === preset.id}
                className={
                  presetId === preset.id
                    ? "rounded-full bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-300"
                    : "rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                }
                key={preset.id}
                onClick={() => handlePresetClick(preset.id)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-700">
            Dato
            <input
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              onChange={(event) => handleDateChange(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Klokkeslett
            <input
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              onChange={(event) => handleTimeChange(event.target.value)}
              type="time"
              value={time}
            />
          </label>
        </div>

        {isPastDue ? (
          <p className="mt-3 text-sm leading-6 text-amber-800">
            Tidspunktet er i fortiden. Påminnelsen kan likevel opprettes.
          </p>
        ) : null}

        {formError ? (
          <p className="mt-3 text-sm leading-6 text-rose-700">{formError}</p>
        ) : null}

        <details
          className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          onToggle={(event) => setHelpOpen(event.currentTarget.open)}
          open={helpOpen}
        >
          <summary className="cursor-pointer text-sm font-medium text-slate-800">
            {launchMayHaveFailed
              ? "Snarveien åpnet ikke"
              : "Hvordan installere snarveien"}
          </summary>
          <div className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
            <p>
              Webapper kan ikke opprette Apple-påminnelser direkte. Du trenger
              snarveien <strong>{RECIPE_REMINDER_SHORTCUT_NAME}</strong> i appen
              Snarveier. Navnet må være nøyaktig likt.
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Åpne Snarveier og lag en ny snarvei.</li>
              <li>
                Gi den navnet {RECIPE_REMINDER_SHORTCUT_NAME}.
              </li>
              <li>Legg til «Motta tekst» fra snarvei-inndata.</li>
              <li>Legg til «Hent ordbok fra inndata».</li>
              <li>
                Legg til «Legg til ny påminnelse» med tittel fra `title`,
                forfall fra `dueISO`, og URL/notater fra `url`.
              </li>
            </ol>
            <button
              className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
              onClick={() => void handleCopyShortcutName()}
              type="button"
            >
              {nameCopied ? "Navnet er kopiert" : "Kopier snarveinavn"}
            </button>
          </div>
        </details>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            Avbryt
          </button>
          <button
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={!canSubmit}
            onClick={handleCreate}
            type="button"
          >
            Opprett i Påminnelser
          </button>
        </div>
      </div>
    </div>
  );
}

function getCreateErrorMessage(error: "EMPTY_TITLE" | "INVALID_DATE" | "INVALID_URL") {
  switch (error) {
    case "EMPTY_TITLE":
      return "Skriv inn en tekst til påminnelsen.";
    case "INVALID_DATE":
      return "Velg en gyldig dato og et klokkeslett.";
    case "INVALID_URL":
      return "Kunne ikke lage en lenke tilbake til oppskriften.";
  }
}
