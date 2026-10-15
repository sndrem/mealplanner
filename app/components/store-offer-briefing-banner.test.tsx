// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StoreOfferBriefingBanner } from "./store-offer-briefing-banner";
import { renderWithRouter } from "../test/render-with-router";

const content = [
  "Rema 1000 ser ut til å være beste hovedbutikk.",
  "",
  "Rema 1000",
  "Laksefilet uten skinn 500 g, 79,20, til kremet laks",
  "",
  "Uten tilbud: svin indrefilet, kremfløte",
].join("\n");

const briefing = {
  content,
  id: "briefing-1",
  subtitle: "De fleste tilbudene går ut lørdag 17. okt. Handle i helgen.",
  title: "Rema 1000 er beste hovedbutikk",
  updatedAt: "2026-10-15T10:00:00.000Z",
  weekEnd: "2026-10-25",
  weekStart: "2026-10-19",
};

describe("StoreOfferBriefingBanner", () => {
  it("shows the title and subtitle until the findings are expanded", () => {
    renderWithRouter(
      <StoreOfferBriefingBanner
        familyId="family-1"
        selection={{ briefing, kind: "loud" }}
      />,
    );

    expect(
      screen.getByText("Rema 1000 er beste hovedbutikk"),
    ).toBeInTheDocument();
    expect(screen.getByText(/lørdag 17\. okt/)).toBeInTheDocument();
    expect(screen.getByText("Ny")).toBeInTheDocument();

    const details = screen.getByText("Ukens tilbud").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(details?.textContent).toContain(
      "Laksefilet uten skinn 500 g, 79,20, til kremet laks",
    );
    expect(details?.textContent).toContain("\n\nRema 1000\n");

    fireEvent.click(screen.getByText("Rema 1000 er beste hovedbutikk"));

    expect(details).toHaveAttribute("open");
    expect(screen.queryByText("Ny")).not.toBeInTheDocument();
  });

  it("dismisses the banner and brings Ny back for a new publish", () => {
    const view = renderWithRouter(
      <StoreOfferBriefingBanner
        familyId="family-1"
        selection={{ briefing, kind: "loud" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skjul" }));
    expect(
      screen.getByRole("button", { name: "Vis ukens tilbud" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Rema 1000 er beste hovedbutikk"),
    ).not.toBeInTheDocument();

    view.unmount();
    renderWithRouter(
      <StoreOfferBriefingBanner
        familyId="family-1"
        selection={{
          briefing: {
            ...briefing,
            updatedAt: "2026-10-16T10:00:00.000Z",
          },
          kind: "loud",
        }}
      />,
    );

    expect(screen.getByText("Ny")).toBeInTheDocument();
    expect(
      screen.getByText("Rema 1000 er beste hovedbutikk"),
    ).toBeInTheDocument();
  });

  it("shows a quiet line after the week has ended", () => {
    renderWithRouter(
      <StoreOfferBriefingBanner
        familyId="family-1"
        selection={{
          kind: "quiet",
          message: "Tilbudene for denne uken er ute",
        }}
      />,
    );

    expect(
      screen.getByText("Tilbudene for denne uken er ute"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ny")).not.toBeInTheDocument();
  });
});
