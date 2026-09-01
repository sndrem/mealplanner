import { useState } from "react";
import { Form } from "react-router";

export function FamilyCalendarSubscriptionCard({
  hasCalendarSubscription,
  httpsUrl,
  isCreating,
  isRevoking,
  isRotating,
  webcalUrl,
}: {
  hasCalendarSubscription: boolean;
  httpsUrl?: string;
  isCreating: boolean;
  isRevoking: boolean;
  isRotating: boolean;
  webcalUrl?: string;
}) {
  const showUrls = Boolean(httpsUrl && webcalUrl);

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-950">
          Abonner i kalenderen
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          Legg til familiens middager i Apple Kalender eller Google Kalender.
          Lenken er hemmelig — ikke del den offentlig. Kalendere henter
          oppdateringer selv, ofte først etter noen timer.
        </p>
      </div>

      {showUrls && httpsUrl && webcalUrl ? (
        <CalendarSubscriptionUrlResult
          httpsUrl={httpsUrl}
          webcalUrl={webcalUrl}
        />
      ) : null}

      {!hasCalendarSubscription ? (
        <Form className="mt-6" method="post">
          <input
            name="intent"
            type="hidden"
            value="create-calendar-subscription"
          />
          <button
            className="inline-flex w-fit items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            type="submit"
          >
            {isCreating ? "Oppretter..." : "Opprett abonnement"}
          </button>
        </Form>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Form
            method="post"
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Bytter du lenke, slutter eksisterende kalendere å oppdatere. Fortsette?",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input
              name="intent"
              type="hidden"
              value="rotate-calendar-subscription"
            />
            <button
              className="inline-flex w-fit items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              type="submit"
            >
              {isRotating ? "Bytter lenke..." : "Bytt lenke"}
            </button>
          </Form>
          <Form
            method="post"
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Opphever du abonnementet, slutter kalendere å hente middager. Fortsette?",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input
              name="intent"
              type="hidden"
              value="revoke-calendar-subscription"
            />
            <button
              className="inline-flex w-fit items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-rose-700"
              type="submit"
            >
              {isRevoking ? "Opphever..." : "Opphev"}
            </button>
          </Form>
        </div>
      )}
    </section>
  );
}

function CalendarSubscriptionUrlResult({
  httpsUrl,
  webcalUrl,
}: {
  httpsUrl: string;
  webcalUrl: string;
}) {
  return (
    <div className="mt-6 grid gap-4">
      <p className="text-sm font-medium text-slate-950">Lenken er klar</p>
      <p className="text-sm leading-6 text-slate-600">
        Kopier HTTPS-lenken til Google Kalender, eller åpne webcal-lenken på
        iPhone. Bytt lenke senere hvis den kommer på avveie — da må enhetene
        abonnere på nytt.
      </p>
      <CopyableCalendarUrl
        label="HTTPS (Google Kalender)"
        url={httpsUrl}
      />
      <CopyableCalendarUrl label="webcal (iPhone)" url={webcalUrl} />
    </div>
  );
}

function CopyableCalendarUrl({
  label,
  url,
}: {
  label: string;
  url: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-slate-400"
        readOnly
        value={url}
      />
      <button
        className="mt-2 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopyState("copied");
          } catch {
            setCopyState("failed");
          }
        }}
        type="button"
      >
        {copyState === "copied" ? "Kopiert" : "Kopier lenke"}
      </button>
      {copyState === "failed" ? (
        <p className="mt-2 text-sm text-rose-700">
          Kunne ikke kopiere. Marker lenken og kopier manuelt.
        </p>
      ) : null}
    </label>
  );
}
