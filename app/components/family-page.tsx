import type { ReactNode } from "react";
import { isRouteErrorResponse, Link, type MetaFunction } from "react-router";

export function familyPageMeta(title: string, description: string): MetaFunction {
  return () => [
    { title },
    { name: "description", content: description },
  ];
}

export const familyBandLinkClassName =
  "rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-on-band transition hover:bg-white/15";

export const familyBandPrimaryLinkClassName =
  "rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accent-strong";

export function FamilyPageHeader({
  actions,
  description,
  kicker,
  sectionClassName = "rounded-[32px] bg-band px-6 py-8 text-white shadow-xl sm:px-8",
  title,
  titleClassName = "mt-4 text-4xl font-semibold tracking-tight",
}: {
  actions?: ReactNode;
  description: ReactNode;
  kicker: string;
  sectionClassName?: string;
  title: string;
  titleClassName?: string;
}) {
  return (
    <section className={sectionClassName}>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-kicker">
            {kicker}
          </span>
          <h1 className={titleClassName}>{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-on-band-muted">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

const noticeToneClassName = {
  accent: {
    description: "mt-2 text-sm leading-6 text-accent-strong",
    section:
      "rounded-[28px] border border-accent/30 bg-accent-soft px-6 py-5 text-ink shadow-sm",
  },
  success: {
    description: "mt-2 text-sm leading-6 text-notice-success-muted",
    section:
      "rounded-[28px] border border-notice-success-line bg-notice-success px-6 py-5 text-notice-success-ink shadow-sm",
  },
} as const;

export function FamilyNoticeBanner({
  description,
  title,
  tone = "accent",
}: {
  description: string;
  title: string;
  tone?: keyof typeof noticeToneClassName;
}) {
  const toneClassName = noticeToneClassName[tone];

  return (
    <section className={toneClassName.section}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className={toneClassName.description}>{description}</p>
    </section>
  );
}

const formErrorToneClassName = {
  danger:
    "rounded-[28px] border border-notice-danger-line bg-notice-danger px-6 py-5 text-notice-danger-ink shadow-sm",
  rose: "rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-900 shadow-sm",
} as const;

export function FamilyFormErrorBanner({
  message,
  title,
  tone = "rose",
}: {
  message: string;
  title: string;
  tone?: keyof typeof formErrorToneClassName;
}) {
  return (
    <section className={formErrorToneClassName[tone]}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6">{message}</p>
    </section>
  );
}

export function FamilyLoadError({
  error,
  fallbackMessage,
}: {
  error: unknown;
  fallbackMessage: string;
}) {
  if (isRouteErrorResponse(error)) {
    return (
      <main className="min-h-screen bg-page px-4 py-12 text-ink">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-surface p-8 shadow-sm ring-1 ring-line">
          <h1 className="text-2xl font-semibold text-ink">
            {error.status} {error.statusText}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {typeof error.data === "string" ? error.data : fallbackMessage}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page px-4 py-12 text-ink">
      <div className="mx-auto max-w-3xl rounded-[28px] bg-surface p-8 shadow-sm ring-1 ring-line">
        <h1 className="text-2xl font-semibold text-ink">Uventet feil</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{fallbackMessage}</p>
      </div>
    </main>
  );
}

export function FamilyUnexpectedError({
  cardClassName = "mx-auto max-w-2xl rounded-[32px] bg-surface p-8 shadow-sm ring-1 ring-line",
  error,
  fallbackMessage,
  messageClassName = "mt-3 text-sm leading-6 text-muted",
  notFoundTitle,
  pageClassName = "min-h-screen bg-page px-4 py-16 text-ink",
  titleClassName = "text-2xl font-semibold text-ink",
}: {
  cardClassName?: string;
  error: unknown;
  fallbackMessage: string;
  messageClassName?: string;
  notFoundTitle: string;
  pageClassName?: string;
  titleClassName?: string;
}) {
  let title = "Noe gikk galt";
  let message = fallbackMessage;

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? notFoundTitle : title;
    message =
      typeof error.data === "string" && error.data.length > 0
        ? error.data
        : error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <main className={pageClassName}>
      <div className={cardClassName}>
        <h1 className={titleClassName}>{title}</h1>
        <p className={messageClassName}>{message}</p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white"
          to="/app"
        >
          Til appen
        </Link>
      </div>
    </main>
  );
}
