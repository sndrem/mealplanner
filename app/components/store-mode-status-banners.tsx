import { StoreOfferBriefingBanner } from "./store-offer-briefing-banner";
import { getStoreModeBannerClass } from "../lib/store-mode-theme";
import type { StoreOfferBriefingSelection } from "../lib/store-offer-briefing";

export function StoreModeStatusBanners({
  familyId,
  formError,
  notice,
  storeOfferBriefing,
}: {
  familyId: string;
  formError?: string;
  notice: { description: string; title: string } | null;
  storeOfferBriefing: StoreOfferBriefingSelection;
}) {
  return (
    <>
      <StoreModeOfferBanner
        familyId={familyId}
        selection={storeOfferBriefing}
      />
      {notice ? (
        <section className={getStoreModeBannerClass("success")}>
          <h2 className="text-base font-semibold">{notice.title}</h2>
          <p className="mt-2 text-sm leading-6 text-notice-success-muted">
            {notice.description}
          </p>
        </section>
      ) : null}
      {formError ? (
        <section className={getStoreModeBannerClass("error")}>
          <h2 className="text-base font-semibold">
            Kunne ikke oppdatere butikkmodus
          </h2>
          <p className="mt-2 text-sm leading-6">{formError}</p>
        </section>
      ) : null}
    </>
  );
}

function StoreModeOfferBanner({
  familyId,
  selection,
}: {
  familyId: string;
  selection: StoreOfferBriefingSelection;
}) {
  if (selection.kind === "hidden") {
    return null;
  }

  return (
    <StoreOfferBriefingBanner
      key={
        selection.kind === "loud"
          ? `${selection.briefing.id}:${selection.briefing.updatedAt}`
          : "store-offer-briefing-quiet"
      }
      familyId={familyId}
      selection={selection}
    />
  );
}
