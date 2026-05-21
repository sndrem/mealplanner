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
        name: /Familievennlig ukeplan og handleliste/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Opprett konto/i })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: /Logg inn/i })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: /prototype/i })).not.toBeInTheDocument();
  });
});
