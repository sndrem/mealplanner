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
    expect(screen.getByRole("link", { name: "Gjennomgang" })).toHaveAttribute(
      "href",
      "/families/family-1/meal-plans/reviews",
    );
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

  it("shows pending review count in the gjennomgang link", () => {
    renderWithRouter(<AppTopNav familyId="family-1" pendingReviewCount={3} />, {
      initialEntries: ["/families/family-1"],
    });

    expect(screen.getByRole("link", { name: "Gjennomgang (3)" })).toHaveAttribute(
      "href",
      "/families/family-1/meal-plans/reviews",
    );
  });

  it("marks the active route in the desktop navigation", () => {
    renderWithRouter(<AppTopNav familyId="family-1" />, {
      initialEntries: ["/families/family-1/stores"],
    });

    expect(screen.getByRole("link", { name: "Butikker" })).toHaveClass("bg-emerald-500");
  });
});
