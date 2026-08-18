// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthForm } from "./auth-form";
import { renderWithRouter } from "../../test/render-with-router";

describe("AuthForm", () => {
  it("renders a forgot-password link on the login form", () => {
    renderWithRouter(
      <AuthForm
        description="Logg inn"
        isSubmitting={false}
        mode="login"
        redirectTo="/app"
      />,
    );

    expect(screen.getByRole("link", { name: "Glemt passord?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("does not render a forgot-password link on the register form", () => {
    renderWithRouter(
      <AuthForm
        description="Opprett konto"
        isSubmitting={false}
        mode="register"
        redirectTo="/app"
      />,
    );

    expect(screen.queryByRole("link", { name: "Glemt passord?" })).not.toBeInTheDocument();
  });
});
