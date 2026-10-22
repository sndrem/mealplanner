// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { type ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { renderWithRouter } from "../test/render-with-router";
import { StoreModeScanBar } from "./store-mode-scan-bar";

function renderScanBar(
  props: Partial<ComponentProps<typeof StoreModeScanBar>> = {},
) {
  return renderWithRouter(
    <StoreModeScanBar
      checkedCount={15}
      focusLabel="Alle åpne"
      storeName="Coop Obs - Vestk"
      totalCount={21}
      {...props}
    >
      <p>Velg handletur-fokus</p>
      <p>Velg butikk</p>
      <p>Velg handledato</p>
      <a href="/share">Del liste</a>
      <a href="/stores">Butikker</a>
      <p>Samme vare</p>
      <p>Skjul kjøpte varer</p>
      <p>Rutenett</p>
    </StoreModeScanBar>,
  );
}

describe("StoreModeScanBar", () => {
  it("shows items left and checked of the whole list", () => {
    renderScanBar();

    expect(screen.getByText("6 igjen")).toBeInTheDocument();
    expect(screen.getByText(/15\/21 krysset av/)).toBeInTheDocument();
    expect(screen.getByText(/Coop Obs - Vestk/)).toBeInTheDocument();
    expect(screen.getByText(/Alle åpne/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "15",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      "21",
    );
  });

  it("hides trip and view controls until Tilpass is opened", () => {
    renderScanBar();

    expect(screen.queryByText("Velg handletur-fokus")).not.toBeInTheDocument();
    expect(screen.queryByText("Velg butikk")).not.toBeInTheDocument();
    expect(screen.queryByText("Velg handledato")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Del liste" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Butikker" })).not.toBeInTheDocument();
    expect(screen.queryByText("Samme vare")).not.toBeInTheDocument();
    expect(screen.queryByText("Skjul kjøpte varer")).not.toBeInTheDocument();
    expect(screen.queryByText("Rutenett")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tilpass" }));

    expect(screen.getByText("Velg handletur-fokus")).toBeInTheDocument();
    expect(screen.getByText("Velg butikk")).toBeInTheDocument();
    expect(screen.getByText("Velg handledato")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Del liste" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Butikker" })).toBeInTheDocument();
    expect(screen.getByText("Samme vare")).toBeInTheDocument();
    expect(screen.getByText("Skjul kjøpte varer")).toBeInTheDocument();
    expect(screen.getByText("Rutenett")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tilpass" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("hides the progress summary in enkel visning and keeps Tilpass", () => {
    renderScanBar({ simpleView: true });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("6 igjen")).not.toBeInTheDocument();
    expect(screen.queryByText(/15\/21 krysset av/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Coop Obs - Vestk/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Alle åpne/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tilpass" }));

    expect(screen.getByText("Rutenett")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tilpass" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows an empty bar when nothing is on the list", () => {
    renderScanBar({ checkedCount: 0, totalCount: 0 });

    expect(screen.getByText("0 igjen")).toBeInTheDocument();
    expect(screen.getByText(/0\/0 krysset av/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      "0",
    );
  });
});
