import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";

interface RenderWithRouterOptions extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: string[];
}

export function renderWithRouter(
  ui: ReactElement,
  { initialEntries = ["/"], ...options }: RenderWithRouterOptions = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: ui,
      },
    ],
    { initialEntries },
  );

  return render(<RouterProvider router={router} />, options);
}
