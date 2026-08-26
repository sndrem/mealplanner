// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { useMemo, useState, type RefObject } from "react";
import type { FetcherWithComponents } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MEAL_PLAN_ENTRIES_AUTOSAVE_INTENT,
  useMealPlanEntriesAutosave,
  type MealPlanEntriesAutosaveData,
} from "./use-meal-plan-entries-autosave";

type AutosaveFetcherState = "idle" | "submitting" | "loading";

function createEntriesForm() {
  const form = document.createElement("form");
  const dateInput = document.createElement("input");
  dateInput.name = "entryDate";
  dateInput.value = "2026-05-15";
  const mealInput = document.createElement("input");
  mealInput.name = "mealSelection:2026-05-15";
  mealInput.value = "recipe:kylling-taco";
  form.append(dateInput, mealInput);
  document.body.append(form);

  return form;
}

function useAutosaveTestHarness({
  blocked = false,
  formRef,
  initialFetcherState = "idle" as AutosaveFetcherState,
}: {
  blocked?: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  initialFetcherState?: AutosaveFetcherState;
}) {
  const [fetcherState, setFetcherState] =
    useState<AutosaveFetcherState>(initialFetcherState);
  const [fetcherData, setFetcherData] = useState<
    MealPlanEntriesAutosaveData | undefined
  >(undefined);
  const [submit] = useState(() =>
    vi.fn(async () => {
      setFetcherState("submitting");
    }),
  );

  const fetcher = useMemo(
    () =>
      ({
        Form: () => null,
        data: fetcherData,
        load: vi.fn(),
        state: fetcherState,
        submit,
      }) as unknown as FetcherWithComponents<MealPlanEntriesAutosaveData>,
    [fetcherData, fetcherState, submit],
  );

  const autosave = useMealPlanEntriesAutosave({
    blocked,
    fetcher,
    formRef,
  });

  return {
    ...autosave,
    setFetcherData,
    setFetcherState,
    submit,
  };
}

describe("useMealPlanEntriesAutosave", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("does not submit until autosave is scheduled", async () => {
    const formRef = { current: createEntriesForm() };
    const { result } = renderHook(() =>
      useAutosaveTestHarness({ formRef }),
    );

    expect(result.current.submit).not.toHaveBeenCalled();
    expect(result.current.isAutosaving).toBe(false);
  });

  it("submits the form with the autosave intent after a scheduled change", async () => {
    const formRef = { current: createEntriesForm() };
    const { result } = renderHook(() =>
      useAutosaveTestHarness({ formRef }),
    );

    act(() => {
      result.current.scheduleAutosave();
    });

    await waitFor(() => {
      expect(result.current.submit).toHaveBeenCalledTimes(1);
    });

    const submittedCall = vi.mocked(result.current.submit).mock.calls.at(0) as
      | [FormData]
      | undefined;

    expect(submittedCall?.[0]).toBeInstanceOf(FormData);
    expect(submittedCall?.[0].get("intent")).toBe(
      MEAL_PLAN_ENTRIES_AUTOSAVE_INTENT,
    );
    expect(submittedCall?.[0].get("mealSelection:2026-05-15")).toBe(
      "recipe:kylling-taco",
    );
    expect(result.current.isAutosaving).toBe(true);
  });

  it("coalesces additional changes into one follow-up submit after the fetcher is idle", async () => {
    const formRef = { current: createEntriesForm() };
    const { result } = renderHook(() =>
      useAutosaveTestHarness({ formRef }),
    );

    act(() => {
      result.current.scheduleAutosave();
    });

    await waitFor(() => {
      expect(result.current.submit).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.scheduleAutosave();
    });

    expect(result.current.submit).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setFetcherData({
        intent: MEAL_PLAN_ENTRIES_AUTOSAVE_INTENT,
        ok: true,
      });
      result.current.setFetcherState("idle");
    });

    await waitFor(() => {
      expect(result.current.submit).toHaveBeenCalledTimes(2);
    });

    const secondSubmitCall = vi.mocked(result.current.submit).mock.calls.at(
      1,
    ) as [FormData] | undefined;

    expect(secondSubmitCall?.[0].get("intent")).toBe(
      MEAL_PLAN_ENTRIES_AUTOSAVE_INTENT,
    );
  });

  it("does not submit while reset or auto-fill is blocked", async () => {
    const formRef = { current: createEntriesForm() };
    const { result } = renderHook(() =>
      useAutosaveTestHarness({ blocked: true, formRef }),
    );

    act(() => {
      result.current.scheduleAutosave();
    });

    await waitFor(() => {
      expect(result.current.isAutosaving).toBe(true);
    });

    expect(result.current.submit).not.toHaveBeenCalled();
  });
});
