// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./home";
import { renderWithRouter } from "../test/render-with-router";

describe("Home", () => {
  it("renders the landing page and auth entry points", () => {
    renderWithRouter(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Ukens middager, klare før mandag/i,
      }),
    ).toBeInTheDocument();
    const registerLinks = screen.getAllByRole("link", { name: "Opprett konto" });
    const loginLinks = screen.getAllByRole("link", { name: "Logg inn" });
    expect(registerLinks.length).toBeGreaterThan(1);
    expect(loginLinks.length).toBeGreaterThan(1);
    for (const link of registerLinks) {
      expect(link).toHaveAttribute("href", "/register");
    }
    for (const link of loginLinks) {
      expect(link).toHaveAttribute("href", "/login");
    }
    expect(screen.queryByRole("link", { name: /prototype/i })).not.toBeInTheDocument();
  });
});
