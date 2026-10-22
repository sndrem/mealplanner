import { describe, expect, it } from "vitest";

import {
  shouldReloadStoreModeTrip,
  shouldRevalidateStoreModeAfterAction,
  shouldRevalidateStoreModeParent,
} from "./store-mode-revalidation";

const storeModePath = "/families/family-1/store-mode";

describe("shouldReloadStoreModeTrip", () => {
  it("reloads only when both tokens are present and they differ", () => {
    expect(
      shouldReloadStoreModeTrip({
        currentRevision: "rev-1",
        nextRevision: "rev-2",
      }),
    ).toBe(true);
    expect(
      shouldReloadStoreModeTrip({
        currentRevision: "rev-1",
        nextRevision: "rev-1",
      }),
    ).toBe(false);
    expect(
      shouldReloadStoreModeTrip({
        currentRevision: "rev-1",
        nextRevision: null,
      }),
    ).toBe(false);
    expect(
      shouldReloadStoreModeTrip({
        currentRevision: null,
        nextRevision: "rev-1",
      }),
    ).toBe(false);
  });
});

describe("shouldRevalidateStoreModeAfterAction", () => {
  it("skips a same-page post and still reloads a navigation or a bare revalidate", () => {
    expect(
      shouldRevalidateStoreModeAfterAction({
        currentPathname: storeModePath,
        defaultShouldRevalidate: true,
        formMethod: "POST",
        nextPathname: storeModePath,
      }),
    ).toBe(false);
    expect(
      shouldRevalidateStoreModeAfterAction({
        currentPathname: storeModePath,
        defaultShouldRevalidate: true,
        formMethod: "POST",
        nextPathname: "/families/family-1/shopping",
      }),
    ).toBe(true);
    expect(
      shouldRevalidateStoreModeAfterAction({
        currentPathname: storeModePath,
        defaultShouldRevalidate: true,
        nextPathname: storeModePath,
      }),
    ).toBe(true);
  });
});

describe("shouldRevalidateStoreModeParent", () => {
  it("skips root and layout on a store-mode reload and still loads them for navigation and posts", () => {
    expect(
      shouldRevalidateStoreModeParent({
        currentPathname: storeModePath,
        defaultShouldRevalidate: true,
        nextPathname: storeModePath,
      }),
    ).toBe(false);
    expect(
      shouldRevalidateStoreModeParent({
        currentPathname: storeModePath,
        defaultShouldRevalidate: true,
        nextPathname: "/families/family-1/recipes",
      }),
    ).toBe(true);
    expect(
      shouldRevalidateStoreModeParent({
        currentPathname: storeModePath,
        defaultShouldRevalidate: true,
        formMethod: "POST",
        nextPathname: storeModePath,
      }),
    ).toBe(true);
    expect(
      shouldRevalidateStoreModeParent({
        currentPathname: "/families/family-1/store-mode/share",
        defaultShouldRevalidate: true,
        nextPathname: "/families/family-1/store-mode/share",
      }),
    ).toBe(true);
  });
});
