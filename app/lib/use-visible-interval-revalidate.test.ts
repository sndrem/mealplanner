// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS,
  useVisibleIntervalRevalidate,
} from "./use-visible-interval-revalidate";

function setDocumentVisible(visible: boolean) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (visible ? "visible" : "hidden"),
  });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => !visible,
  });
}

describe("useVisibleIntervalRevalidate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setDocumentVisible(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not revalidate on mount", () => {
    const revalidate = vi.fn();

    renderHook(() => useVisibleIntervalRevalidate({ revalidate }));

    expect(revalidate).not.toHaveBeenCalled();
  });

  it("revalidates on the interval while the document is visible", () => {
    const revalidate = vi.fn();

    renderHook(() => useVisibleIntervalRevalidate({ revalidate }));

    vi.advanceTimersByTime(STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS - 1);
    expect(revalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(revalidate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS);
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it("skips interval ticks while paused", () => {
    const revalidate = vi.fn();

    renderHook(() =>
      useVisibleIntervalRevalidate({
        paused: true,
        revalidate,
      }),
    );

    vi.advanceTimersByTime(STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS * 2);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("resumes polling after paused becomes false", () => {
    const revalidate = vi.fn();

    const { rerender } = renderHook(
      ({ paused }) => useVisibleIntervalRevalidate({ paused, revalidate }),
      { initialProps: { paused: true } },
    );

    vi.advanceTimersByTime(STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS);
    expect(revalidate).not.toHaveBeenCalled();

    rerender({ paused: false });
    vi.advanceTimersByTime(STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS);
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("does not revalidate while the document is hidden", () => {
    setDocumentVisible(false);
    const revalidate = vi.fn();

    renderHook(() => useVisibleIntervalRevalidate({ revalidate }));

    vi.advanceTimersByTime(STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS * 2);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("revalidates immediately when the document becomes visible", () => {
    setDocumentVisible(false);
    const revalidate = vi.fn();

    renderHook(() => useVisibleIntervalRevalidate({ revalidate }));

    setDocumentVisible(true);
    document.dispatchEvent(new Event("visibilitychange"));

    expect(revalidate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS);
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it("does not revalidate on becoming visible while paused", () => {
    setDocumentVisible(false);
    const revalidate = vi.fn();

    renderHook(() =>
      useVisibleIntervalRevalidate({
        paused: true,
        revalidate,
      }),
    );

    setDocumentVisible(true);
    document.dispatchEvent(new Event("visibilitychange"));

    expect(revalidate).not.toHaveBeenCalled();
  });

  it("revalidates when the browser comes online while visible", () => {
    const revalidate = vi.fn();

    renderHook(() => useVisibleIntervalRevalidate({ revalidate }));

    window.dispatchEvent(new Event("online"));

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("does not revalidate on online while hidden", () => {
    setDocumentVisible(false);
    const revalidate = vi.fn();

    renderHook(() => useVisibleIntervalRevalidate({ revalidate }));

    window.dispatchEvent(new Event("online"));

    expect(revalidate).not.toHaveBeenCalled();
  });

  it("stops polling after unmount", () => {
    const revalidate = vi.fn();

    const { unmount } = renderHook(() =>
      useVisibleIntervalRevalidate({ revalidate }),
    );

    unmount();
    vi.advanceTimersByTime(STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS * 2);

    expect(revalidate).not.toHaveBeenCalled();
  });
});
