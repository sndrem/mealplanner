import { describe, expect, it } from "vitest";

import { resolveStoreModeRecipeUrgency } from "./store-mode-recipe-urgency";

const today = "2026-05-16";

function urgency({
  checked = false,
  earliestDate = today,
  postponedUntilDate = null,
  sourceType = "GENERATED",
}: {
  checked?: boolean;
  earliestDate?: string | null;
  postponedUntilDate?: string | null;
  sourceType?: string;
} = {}) {
  return resolveStoreModeRecipeUrgency({
    checked,
    earliestDate,
    postponedUntilDate,
    sourceType,
    todayDateOnly: today,
  });
}

describe("resolveStoreModeRecipeUrgency", () => {
  it("marks today and tomorrow as soon", () => {
    expect(urgency()).toEqual({ label: "i dag", step: "soon" });
    expect(urgency({ earliestDate: "2026-05-17" })).toEqual({
      label: "i morgen",
      step: "soon",
    });
  });

  it("marks days 2 through 4 as upcoming without a label", () => {
    expect(urgency({ earliestDate: "2026-05-18" })).toEqual({
      label: null,
      step: "upcoming",
    });
    expect(urgency({ earliestDate: "2026-05-20" })).toEqual({
      label: null,
      step: "upcoming",
    });
  });

  it("leaves later, past, and missing dates plain", () => {
    expect(urgency({ earliestDate: "2026-05-21" })).toEqual({
      label: null,
      step: null,
    });
    expect(urgency({ earliestDate: "2026-05-15" })).toEqual({
      label: null,
      step: null,
    });
    expect(urgency({ earliestDate: null })).toEqual({
      label: null,
      step: null,
    });
  });

  it("stays plain for checked, postponed, manual, and family items", () => {
    expect(urgency({ checked: true })).toEqual({ label: null, step: null });
    expect(urgency({ postponedUntilDate: "2026-05-20" })).toEqual({
      label: null,
      step: null,
    });
    expect(urgency({ sourceType: "MANUAL" })).toEqual({
      label: null,
      step: null,
    });
    expect(urgency({ sourceType: "FAMILY" })).toEqual({
      label: null,
      step: null,
    });
  });
});
