import { useEffect, useState } from "react";

import {
  SHOPPING_LIST_COMPLETE_BODY,
  SHOPPING_LIST_COMPLETE_HEADING,
} from "../lib/shopping-list-completion.client";
import {
  getStoreModeBannerClass,
  storeModeCompleteCelebrationChromeClass,
} from "../lib/store-mode-theme";
import { usePrefersReducedMotion } from "../lib/use-prefers-reduced-motion";

interface ShoppingListCompleteCelebrationProps {
  className?: string;
  onDismiss?: () => void;
  variant: "inline" | "chrome";
}

export function ShoppingListCompleteCelebration({
  className = "",
  onDismiss,
  variant,
}: ShoppingListCompleteCelebrationProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isVisible, setIsVisible] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [prefersReducedMotion]);

  const motionClass = prefersReducedMotion
    ? ""
    : isVisible
      ? "translate-y-0 scale-100 opacity-100"
      : "translate-y-1 scale-[0.98] opacity-0";
  const transitionClass = prefersReducedMotion
    ? ""
    : "transition duration-300 ease-out motion-reduce:transition-none";

  if (variant === "chrome") {
    return (
      <div
        aria-live="polite"
        className={`${storeModeCompleteCelebrationChromeClass} ${transitionClass} ${motionClass} ${className}`.trim()}
        role="status"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-emerald-950">
            {SHOPPING_LIST_COMPLETE_HEADING}
          </p>
          <p className="mt-0.5 text-sm leading-5 text-emerald-900">
            {SHOPPING_LIST_COMPLETE_BODY}
          </p>
        </div>
        {onDismiss ? (
          <button
            aria-label="Lukk"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-emerald-700 transition hover:bg-emerald-100/80 hover:text-emerald-950"
            onClick={onDismiss}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-live="polite"
      className={`${getStoreModeBannerClass("success")} ${transitionClass} ${motionClass} ${className}`.trim()}
      role="status"
    >
      <h2 className="text-base font-semibold">{SHOPPING_LIST_COMPLETE_HEADING}</h2>
      <p className="mt-2 text-sm leading-6 text-emerald-900">
        {SHOPPING_LIST_COMPLETE_BODY}
      </p>
    </section>
  );
}
