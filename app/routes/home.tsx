import { Link, type MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Mealplanner" },
    {
      name: "description",
      content: "Prototype og videre arbeid for Mealplanner.",
    },
  ];
};

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
            Mealplanner
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight">
            Prototype for familievennlig ukeplan og handleliste
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Prototypen ligger i sin egen mappe slik at vi kan utforske flyten
            uten å blande den sammen med den framtidige produksjonsappen.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
              to="/register"
            >
              Opprett konto
            </Link>
            <Link
              className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/15"
              to="/login"
            >
              Logg inn
            </Link>
            <Link
              className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/15"
              to="/prototype"
            >
              Åpne prototype
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Ukeplan",
              description:
                "Velg middager for hver dag og marker når menyen er klar for godkjenning.",
            },
            {
              title: "Handleliste",
              description:
                "Genereres automatisk fra ukens oppskrifter og kan kombineres med egne varer.",
            },
            {
              title: "Butikkmodus",
              description:
                "Mobilvennlig visning med sortering per butikk og varer som kan utsettes.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <h2 className="text-lg font-semibold text-slate-950">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
