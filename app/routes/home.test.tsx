// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./home";
import { renderWithRouter } from "../test/render-with-router";

describe("Home", () => {
  it("renders the landing page and prototype entry point", () => {
    renderWithRouter(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /Prototype for familievennlig ukeplan og handleliste/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Åpne prototype/i }),
    ).toHaveAttribute("href", "/prototype");
  });
});
