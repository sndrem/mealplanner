import type { MouseEvent } from "react";
import { useState } from "react";

import {
  buildStoreOfferBriefingDismissedStorageKey,
  buildStoreOfferBriefingSeenStorageKey,
  readStoreModeStockReminderDismissed,
  writeStoreModeStockReminderDismissed,
} from "../lib/shopping-store-mode-client";
import type { LoudStoreOfferBriefing } from "../lib/store-offer-briefing";
import {
  getStoreModeBannerClass,
  storeModeOfferChipClass,
  storeModeOfferQuietClass,
} from "../lib/store-mode-theme";

type StoreOfferBriefingBannerProps = {
  familyId: string;
  selection: LoudStoreOfferBriefing | { kind: "quiet"; message: string };
};

export function StoreOfferBriefingBanner({
  familyId,
  selection,
}: StoreOfferBriefingBannerProps) {
  if (selection.kind === "quiet") {
    return (
      <p className={storeModeOfferQuietClass}>{selection.message}</p>
    );
  }

  return (
    <LoudStoreOfferBriefingBanner
      familyId={familyId}
      briefing={selection.briefing}
    />
  );
}

function LoudStoreOfferBriefingBanner({
  briefing,
  familyId,
}: {
  briefing: LoudStoreOfferBriefing["briefing"];
  familyId: string;
}) {
  const seenKey = buildStoreOfferBriefingSeenStorageKey({
    briefingId: briefing.id,
    familyId,
    updatedAt: briefing.updatedAt,
  });
  const dismissedKey = buildStoreOfferBriefingDismissedStorageKey({
    briefingId: briefing.id,
    familyId,
    updatedAt: briefing.updatedAt,
  });
  const [seen, setSeen] = useState(() =>
    readStoreModeStockReminderDismissed(seenKey),
  );
  const [dismissed, setDismissed] = useState(() =>
    readStoreModeStockReminderDismissed(dismissedKey),
  );

  const markSeen = () => {
    setSeen(true);
    writeStoreModeStockReminderDismissed(seenKey, true);
  };

  const handleDismiss = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDismissed(true);
    writeStoreModeStockReminderDismissed(dismissedKey, true);
  };

  const handleRestore = () => {
    setDismissed(false);
    writeStoreModeStockReminderDismissed(dismissedKey, false);
  };

  const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest("button")) {
      return;
    }

    markSeen();
  };

  if (dismissed) {
    return (
      <button
        className={`${getStoreModeBannerClass("offer")} w-full text-left`}
        onClick={handleRestore}
        type="button"
      >
        Vis ukens tilbud
      </button>
    );
  }

  return (
    <details className={getStoreModeBannerClass("offer")}>
      <summary
        className="flex cursor-pointer list-none items-start justify-between gap-3 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-store-accent [&::-webkit-details-marker]:hidden"
        onClick={handleSummaryClick}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-store-accent-text">
              Ukens tilbud
            </span>
            {seen ? null : (
              <span className={storeModeOfferChipClass}>Ny</span>
            )}
          </span>
          <span className="mt-2 block text-base font-semibold text-store-ink">
            {briefing.title}
          </span>
          <span className="mt-1 block text-sm leading-6 text-store-muted">
            {briefing.subtitle}
          </span>
        </span>
        <button
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-store-muted transition hover:bg-store-accent/10 hover:text-store-ink"
          onClick={handleDismiss}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          type="button"
        >
          Skjul
        </button>
      </summary>
      <p className="mt-4 whitespace-pre-wrap border-t border-store-accent/20 pt-4 text-sm leading-6 text-store-ink wrap-break-word">
        {briefing.content}
      </p>
    </details>
  );
}
