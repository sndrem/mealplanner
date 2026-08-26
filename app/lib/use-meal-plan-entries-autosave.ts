import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { FetcherWithComponents } from "react-router";

export const MEAL_PLAN_ENTRIES_AUTOSAVE_INTENT = "autosave-meal-plan-entries";

export interface MealPlanEntriesAutosaveData {
  entryFormError?: string;
  intent?: string;
  ok?: boolean;
}

export function useMealPlanEntriesAutosave({
  blocked,
  fetcher,
  formRef,
}: {
  blocked: boolean;
  fetcher: FetcherWithComponents<MealPlanEntriesAutosaveData>;
  formRef: RefObject<HTMLFormElement | null>;
}) {
  const dirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const fetcherRef = useRef(fetcher);
  const formRefValue = formRef;

  fetcherRef.current = fetcher;

  const flushAutosave = useCallback(() => {
    const currentFetcher = fetcherRef.current;

    if (blocked || currentFetcher.state !== "idle" || !dirtyRef.current) {
      return;
    }

    const form = formRefValue.current;

    if (!form) {
      return;
    }

    dirtyRef.current = false;
    setIsDirty(false);

    const formData = new FormData(form);
    formData.set("intent", MEAL_PLAN_ENTRIES_AUTOSAVE_INTENT);
    currentFetcher.submit(formData, { method: "post" });
  }, [blocked, formRefValue]);

  const scheduleAutosave = useCallback(() => {
    dirtyRef.current = true;
    setIsDirty(true);
  }, []);

  useEffect(() => {
    flushAutosave();
  }, [blocked, fetcher.state, flushAutosave, isDirty]);

  return {
    entryFormError:
      fetcher.data?.intent === MEAL_PLAN_ENTRIES_AUTOSAVE_INTENT
        ? fetcher.data.entryFormError
        : undefined,
    isAutosaving: fetcher.state !== "idle" || isDirty,
    scheduleAutosave,
  };
}
