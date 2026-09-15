import type { ReactNode } from "react";
import { Link } from "react-router";

export const authInputClassName =
  "mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

export const authSubmitButtonClassName =
  "inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400";

interface AuthScreenProps {
  alternateHref?: string;
  alternateLabel?: string;
  children: ReactNode;
  description: string;
  heading: string;
}

export function AuthScreen({
  alternateHref,
  alternateLabel,
  children,
  description,
  heading,
}: AuthScreenProps) {
  return (
    <main className="min-h-screen bg-page px-4 py-12 text-ink">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
            Mealplanner
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">{description}</p>
          <div className="mt-6">
            <Link
              className="inline-flex rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
              to="/"
            >
              Til forsiden
            </Link>
          </div>
        </section>

        <section className="rounded-[32px] bg-surface p-6 shadow-sm ring-1 ring-line sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">{heading}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
            </div>
            {alternateHref && alternateLabel ? (
              <Link className="text-sm font-medium text-emerald-700 hover:text-emerald-800" to={alternateHref}>
                {alternateLabel}
              </Link>
            ) : null}
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}
