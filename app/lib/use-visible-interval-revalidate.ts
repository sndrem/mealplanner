import { useEffect, useRef } from "react";

export const STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS = 4000;

function isDocumentVisible() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.visibilityState !== "hidden";
}

export function useVisibleIntervalRevalidate({
  intervalMs = STORE_MODE_LIVE_REVALIDATE_INTERVAL_MS,
  paused = false,
  revalidate,
}: {
  intervalMs?: number;
  paused?: boolean;
  revalidate: () => void;
}) {
  const intervalMsRef = useRef(intervalMs);
  const pausedRef = useRef(paused);
  const revalidateRef = useRef(revalidate);

  intervalMsRef.current = intervalMs;
  pausedRef.current = paused;
  revalidateRef.current = revalidate;

  useEffect(() => {
    let intervalId: number | null = null;

    function tick() {
      if (!isDocumentVisible() || pausedRef.current) {
        return;
      }

      revalidateRef.current();
    }

    function stop() {
      if (intervalId === null) {
        return;
      }

      window.clearInterval(intervalId);
      intervalId = null;
    }

    function start() {
      stop();
      intervalId = window.setInterval(tick, intervalMsRef.current);
    }

    function handleVisibilityChange() {
      if (!isDocumentVisible()) {
        stop();
        return;
      }

      tick();
      start();
    }

    function handleOnline() {
      if (!isDocumentVisible()) {
        return;
      }

      tick();
    }

    if (isDocumentVisible()) {
      start();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, []);
}
