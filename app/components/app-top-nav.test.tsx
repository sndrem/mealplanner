// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppTopNav } from "./app-top-nav";
import { renderWithRouter } from "../test/render-with-router";

describe("AppTopNav", () => {
  it("renders all family links when familyId is provided", () => {
    renderWithRouter(<AppTopNav familyId="family-1" />, {
      initialEntries: ["/families/family-1"],
    });

    expect(screen.getByRole("link", { name: "Familie" })).toHaveAttribute(
      "href",
      "/families/family-1",
    );
    expect(screen.getByRole("link", { name: "Ukeplaner" })).toHaveAttribute(
      "href",
      "/families/family-1/meal-plans",
    );
    expect(
      screen.queryByRole("link", { name: "Middagstats" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Gjennomgang" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Butikker" })).toHaveAttribute(
      "href",
      "/families/family-1/stores",
    );
    expect(screen.getByRole("link", { name: "Oppskrifter" })).toHaveAttribute(
      "href",
      "/families/family-1/recipes",
    );
    expect(screen.getByRole("link", { name: "Basisvarer" })).toHaveAttribute(
      "href",
      "/families/family-1/stock-ingredients",
    );
    expect(screen.getByRole("link", { name: "Handlevarer" })).toHaveAttribute(
      "href",
      "/families/family-1/shopping-catalog",
    );
    expect(screen.getByRole("link", { name: "Fryser" })).toHaveAttribute(
      "href",
      "/families/family-1/freezer",
    );
    expect(screen.getByRole("link", { name: "Oversikt" })).toHaveAttribute("href", "/app");
  });

  it("renders only oversikt when familyId is missing", () => {
    renderWithRouter(<AppTopNav familyId={null} />, {
      initialEntries: ["/app"],
    });

    expect(screen.getByRole("link", { name: "Oversikt" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Familie" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ukeplaner" })).not.toBeInTheDocument();
  });

  it("links the logo placeholder to the application root", () => {
    renderWithRouter(<AppTopNav familyId={null} />);

    expect(screen.getByRole("link", { name: "Mealplanner forsiden" })).toHaveAttribute("href", "/");
  });

  it("toggles the mobile menu and closes it with Escape", () => {
    renderWithRouter(<AppTopNav familyId="family-1" />, {
      initialEntries: ["/families/family-1"],
    });

    const toggle = screen.getByRole("button", { name: "Åpne meny" });

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Lukk meny" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Hovedmeny mobil" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Åpne meny" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Hovedmeny mobil" })).not.toBeInTheDocument();
  });

  it("marks the active route in the desktop navigation", () => {
    renderWithRouter(<AppTopNav familyId="family-1" />, {
      initialEntries: ["/families/family-1/stores"],
    });

    expect(screen.getByRole("link", { name: "Butikker" })).toHaveClass("bg-emerald-500");
  });

  it("shows the theme toggle in desktop nav and the mobile menu", () => {
    renderWithRouter(<AppTopNav familyId="family-1" />, {
      initialEntries: ["/families/family-1"],
    });

    expect(screen.getByRole("radiogroup", { name: "Utseende" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Åpne meny" }));

    expect(screen.getAllByRole("radiogroup", { name: "Utseende" })).toHaveLength(2);
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Lyst")).toBeInTheDocument();
    expect(screen.getByText("Mørkt")).toBeInTheDocument();
  });
});
