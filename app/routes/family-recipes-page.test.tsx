// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import FamilyRecipesRoute from "./family-recipes";

const OriginalRequest = globalThis.Request;

// jsdom's AbortSignal is not undici's AbortSignal, so React Router's
// client navigations throw before the address updates. Drop the signal.
beforeAll(() => {
  class TestRequest extends OriginalRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      const nextInit = init ? { ...init } : undefined;

      if (nextInit && "signal" in nextInit) {
        delete nextInit.signal;
      }

      super(input, nextInit);
    }
  }

  globalThis.Request = TestRequest;
});

afterAll(() => {
  globalThis.Request = OriginalRequest;
});

function recipe({
  id,
  tags,
  title,
  description = title,
}: {
  description?: string;
  id: string;
  tags: string[];
  title: string;
}) {
  return {
    _count: { ingredients: 1, mealPlanEntries: 0 },
    defaultServings: 4,
    description,
    id,
    imageUrl: null,
    prepMinutes: 20,
    tags,
    title,
  };
}

const familyRecipes = [
  recipe({ id: "pie", tags: ["middag"], title: "Familiepai" }),
  recipe({ id: "taco", tags: ["middag", "rask"], title: "Kyllingtaco" }),
];

const globalRecipes = [
  recipe({ description: "Varm suppe", id: "soup", tags: ["suppe"], title: "Tomatsuppe" }),
];

function loaderData(userRole: "ADMIN" | "MEMBER" = "MEMBER") {
  return {
    categories: [
      { displayName: "Meieri", familyId: null, id: "category-dairy", key: "dairy" },
    ],
    family: { id: "family-1", name: "Solberg" },
    familyRecipes,
    globalRecipes,
    notice: null,
    returnTo: "",
    r2Configured: false,
    userRole,
  };
}

function renderRecipes(initialEntry: string, userRole: "ADMIN" | "MEMBER" = "MEMBER") {
  const router = createMemoryRouter(
    [
      {
        path: "/families/:familyId/recipes",
        element: (
          <FamilyRecipesRoute
            loaderData={
              loaderData(userRole) as ComponentProps<
                typeof FamilyRecipesRoute
              >["loaderData"]
            }
          />
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );

  render(<RouterProvider router={router} />);

  return router;
}

describe("family recipes page filter", () => {
  it("filters both lists from tag chips and replaces the address", async () => {
    const router = renderRecipes("/families/family-1/recipes");

    expect(screen.getByRole("button", { name: "middag (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "rask (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "suppe (1)" })).toBeInTheDocument();

    const pie = screen.getByRole("heading", { name: "Familiepai" }).closest("article");
    expect(pie).not.toBeNull();
    expect(within(pie as HTMLElement).queryByRole("button")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "rask (1)" }));

    await waitFor(() => {
      expect(router.state.location.search).toBe("?tag=rask");
    });
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.getByRole("heading", { name: "Kyllingtaco" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Familiepai" })).not.toBeInTheDocument();
    expect(screen.getByText("Ingen standardoppskrifter matcher filteret.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "middag (2)" }));

    await waitFor(() => {
      expect(router.state.location.search).toBe("?tag=rask&tag=middag");
    });
    expect(screen.getByRole("heading", { name: "Kyllingtaco" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Familiepai" })).not.toBeInTheDocument();

    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.search).toBe("?tag=rask&tag=middag");

    fireEvent.click(screen.getByRole("button", { name: "Nullstill filtre" }));

    await waitFor(() => {
      expect(router.state.location.search).toBe("");
    });
    expect(screen.getByRole("heading", { name: "Familiepai" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tomatsuppe" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nullstill filtre" })).not.toBeInTheDocument();
  });

  it("drops a tag no recipe has and still shows both lists", async () => {
    const router = renderRecipes(
      "/families/family-1/recipes?tag=borte&notice=recipe-created",
    );

    await waitFor(() => {
      expect(router.state.location.search).toBe("?notice=recipe-created");
    });
    expect(screen.getByRole("heading", { name: "Familiepai" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tomatsuppe" })).toBeInTheDocument();
    expect(
      screen.queryByText("Ingen familieoppskrifter matcher filteret."),
    ).not.toBeInTheDocument();
  });

  it("filters by the text field and names an empty family section", async () => {
    const router = renderRecipes("/families/family-1/recipes");
    const search = screen.getByRole("searchbox", { name: "Søk oppskrifter" });

    expect(search).toHaveClass("text-base");

    fireEvent.change(search, { target: { value: "tomat" } });

    await waitFor(() => {
      expect(router.state.location.search).toBe("?q=tomat");
    });
    expect(screen.getByText("Ingen familieoppskrifter matcher filteret.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tomatsuppe" })).toBeInTheDocument();
  });
});
