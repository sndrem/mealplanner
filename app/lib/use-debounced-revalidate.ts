import { useCallback, useEffect, useRef } from "react";

export function useDebouncedRevalidate(
  revalidate: () => void,
  delayMs = 600,
) {
  const timeoutRef = useRef<number | null>(null);
  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      revalidateRef.current();
    }, delayMs);
  }, [delayMs]);
}
