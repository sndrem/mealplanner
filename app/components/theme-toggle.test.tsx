// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "./theme-toggle";
import { renderWithRouter } from "../test/render-with-router";

describe("ThemeToggle", () => {
  it("posts each theme preference from mobile labels", () => {
    const { container } = renderWithRouter(<ThemeToggle variant="mobile" />);

    expect(screen.getByRole("radiogroup", { name: "Utseende" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Lyst" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Mørkt" })).toBeInTheDocument();
    expect(
      [...container.querySelectorAll('input[name="themePreference"]')].map(
        (input) => (input as HTMLInputElement).value,
      ),
    ).toEqual(["SYSTEM", "LIGHT", "DARK"]);
  });

  it("renders desktop icon controls with accessible names", () => {
    renderWithRouter(<ThemeToggle variant="desktop" />);

    expect(screen.getByRole("radiogroup", { name: "Utseende" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Lyst" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Mørkt" })).toBeInTheDocument();
  });
});
