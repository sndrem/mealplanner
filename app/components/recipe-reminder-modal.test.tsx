// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecipeReminderModal } from "./recipe-reminder-modal";
import { renderWithRouter } from "../test/render-with-router";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36";

function stubNavigator({
  maxTouchPoints = 5,
  platform = "iPhone",
  userAgent = IPHONE_UA,
}: {
  maxTouchPoints?: number;
  platform?: string;
  userAgent?: string;
} = {}) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

describe("RecipeReminderModal", () => {
  beforeEach(() => {
    stubNavigator();
    vi.stubGlobal("location", {
      ...window.location,
      assign: vi.fn(),
      origin: "https://mealplanner.example",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults the reminder text to the recipe title and fills tomorrow-morning", () => {
    renderWithRouter(
      <RecipeReminderModal
        familyId="family-1"
        onClose={vi.fn()}
        recipeId="recipe-1"
        recipeTitle="Pizza"
      />,
    );

    expect(screen.getByLabelText("Tekst")).toHaveValue("Pizza");
    expect(
      screen.getByRole("button", { name: "I morgen tidlig" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Dato")).toBeInTheDocument();
    expect(screen.getByLabelText("Klokkeslett")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Opprett i Påminnelser" }),
    ).toBeEnabled();
  });

  it("lets the user pick a suggestion as the reminder title", () => {
    renderWithRouter(
      <RecipeReminderModal
        familyId="family-1"
        onClose={vi.fn()}
        recipeId="recipe-1"
        recipeTitle="Pizza"
        suggestions={[
          { id: "dough", title: "Ta deigen ut av kjøleskapet" },
          { id: "bake", title: "Sett ovnen på" },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ta deigen ut av kjøleskapet" }),
    );
    expect(screen.getByLabelText("Tekst")).toHaveValue(
      "Ta deigen ut av kjøleskapet",
    );
  });

  it("prefills the title from initialSuggestionId", () => {
    renderWithRouter(
      <RecipeReminderModal
        familyId="family-1"
        initialSuggestionId="dough"
        onClose={vi.fn()}
        recipeId="recipe-1"
        recipeTitle="Pizza"
        suggestions={[
          { id: "dough", title: "Ta deigen ut av kjøleskapet" },
          { id: "bake", title: "Sett ovnen på" },
        ]}
      />,
    );

    expect(screen.getByLabelText("Tekst")).toHaveValue(
      "Ta deigen ut av kjøleskapet",
    );
  });

  it("explains that the shortcut is required and disables create off iOS", () => {
    stubNavigator({
      maxTouchPoints: 0,
      platform: "Linux x86_64",
      userAgent: ANDROID_UA,
    });

    renderWithRouter(
      <RecipeReminderModal
        familyId="family-1"
        onClose={vi.fn()}
        recipeId="recipe-1"
        recipeTitle="Pizza"
      />,
    );

    expect(
      screen.getByText(/fungerer i Safari på iPhone og iPad/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Opprett i Påminnelser" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Hvordan installere snarveien"),
    ).toBeInTheDocument();
  });

  it("launches the shortcut URL with the edited title", () => {
    renderWithRouter(
      <RecipeReminderModal
        familyId="family-1"
        onClose={vi.fn()}
        recipeId="recipe-1"
        recipeTitle="Pizza"
      />,
    );

    fireEvent.change(screen.getByLabelText("Tekst"), {
      target: { value: "Lag pizzadeig" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Opprett i Påminnelser" }),
    );

    expect(window.location.assign).toHaveBeenCalledTimes(1);
    const launchedUrl = vi.mocked(window.location.assign).mock.calls[0]?.[0];
    expect(launchedUrl).toContain("shortcuts://run-shortcut?");
    expect(launchedUrl).toContain("Create%20Recipe%20Reminder");
    expect(decodeURIComponent(String(launchedUrl))).toContain("Lag pizzadeig");
  });
});
