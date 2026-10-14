import { Link, type MetaFunction } from "react-router";

import { LandingMealIcon, type LandingMealId } from "../components/landing-meal-icons";

export const meta: MetaFunction = () => {
  return [
    { title: "Mealplanner" },
    {
      name: "description",
      content: "Planlegg ukens middager for familien. Handlelisten lages fra oppskriftene.",
    },
  ];
};

const week: { day: string; dish: string; id: LandingMealId }[] = [
  { day: "Mandag", dish: "Kjøttkaker og potetmos", id: "kjottkaker" },
  { day: "Tirsdag", dish: "Ovnsbakt laks", id: "laks" },
  { day: "Onsdag", dish: "Pasta med kjøttsaus", id: "pasta" },
  { day: "Torsdag", dish: "Kyllingwok", id: "wok" },
  { day: "Fredag", dish: "Taco", id: "taco" },
  { day: "Lørdag", dish: "Hjemmelaget pizza", id: "pizza" },
  { day: "Søndag", dish: "Lapskaus", id: "lapskaus" },
];

const shoppingList = [
  ["Kjøttdeig", "500 g"],
  ["Poteter", "1,5 kg"],
  ["Laksefilet", "600 g"],
  ["Spagetti", "500 g"],
  ["Tacokrydder", "1 pose"],
  ["Paprika", "3 stk"],
];

const parts = [
  {
    number: "01",
    title: "Ukeplan",
    description: "Velg middag for hver dag, og marker når menyen er klar.",
  },
  {
    number: "02",
    title: "Handleliste",
    description: "Listen lages fra ukens oppskrifter, og egne varer kan legges til.",
  },
  {
    number: "03",
    title: "Butikkmodus",
    description: "Mobilvennlig visning, sortert per butikk. Varer som kan vente, settes til side.",
  },
];

function BrandMark() {
  return (
    <svg aria-hidden="true" height="28" viewBox="0 0 32 32" width="28">
      <rect fill="#0f766e" height="32" rx="9" width="32" />
      <path d="M8 14h16l-2 10a6 6 0 0 1-12 0Z" fill="#fffdf8" />
      <path
        d="M12 13c.2-3 2.2-5 4-5s3.8 2 4 5"
        fill="none"
        stroke="#fffdf8"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

const primaryButtonClassName =
  "min-h-12 items-center justify-center rounded-full bg-accent px-5 py-3 text-base font-semibold text-white transition hover:bg-accent-strong";

const bandButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-5 py-3 text-base font-semibold text-on-band transition hover:bg-white/10";

export default function Home() {
  return (
    <main className="min-h-screen bg-page text-ink">
      <header className="bg-band px-5 pt-6 pb-16 text-on-band sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-12 flex items-center justify-between gap-4">
            <Link className="flex items-center gap-2.5 text-base font-bold tracking-tight" to="/">
              <BrandMark />
              Mealplanner
            </Link>
            <nav className="flex items-center gap-3">
              <Link className="text-base font-semibold text-on-band-muted" to="/login">
                Logg inn
              </Link>
              <Link className={`hidden sm:inline-flex ${primaryButtonClassName}`} to="/register">
                Opprett konto
              </Link>
            </nav>
          </div>
          <p className="text-xs font-bold tracking-[0.16em] text-kicker uppercase">
            Familieukeplan
          </p>
          <h1 className="mt-3 max-w-[16ch] text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Ukens middager, klare før mandag
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-on-band-muted">
            Planlegg ukens middager for familien. Handlelisten lages fra oppskriftene.
            Butikkmodus er klar når dere står i butikken.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className={`inline-flex ${primaryButtonClassName}`} to="/register">
              Opprett konto
            </Link>
            <Link className={bandButtonClassName} to="/login">
              Logg inn
            </Link>
          </div>
          <p className="mt-4 text-sm text-on-band-quiet">
            Inviter resten av familien med en familiekode.
          </p>
        </div>
      </header>

      <div className="-mt-9 px-4 sm:px-8">
        <section className="mx-auto w-full max-w-5xl rounded-[28px] border border-line bg-surface p-5 shadow-xl">
          <h2 className="text-2xl font-semibold tracking-tight">En vanlig uke</h2>
          <p className="mt-1 text-muted">Slik kan en uke se ut når middagen er valgt.</p>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {week.map((meal) => (
              <li
                className="grid grid-cols-[4rem_1fr] items-center gap-3 rounded-2xl border border-line bg-paper p-3"
                key={meal.day}
              >
                <LandingMealIcon id={meal.id} />
                <p>
                  <span className="block text-xs font-bold tracking-[0.08em] text-accent uppercase">
                    {meal.day}
                  </span>
                  <strong className="mt-0.5 block text-base tracking-tight">{meal.dish}</strong>
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ukeplan, handleliste og butikkmodus
        </h2>
        <p className="mt-1 text-muted">Tre deler som følger samme uke.</p>
        <ol className="mt-5 grid gap-0 md:grid-cols-3 md:gap-6">
          {parts.map((part) => (
            <li className="border-t border-line py-4" key={part.number}>
              <span className="text-xs font-bold tracking-[0.12em] text-accent uppercase">
                {part.number}
              </span>
              <strong className="mt-1 block text-xl tracking-tight">{part.title}</strong>
              <p className="mt-1 text-muted">{part.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-5 px-5 pb-12 sm:px-8 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Handlelisten fra denne uken</h2>
          <p className="mt-1 text-muted">Varene hører til uken over. Egne varer kan legges til.</p>
        </div>
        <ul className="rounded-[20px] border border-line bg-surface px-5">
          {shoppingList.map(([name, amount]) => (
            <li
              className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0"
              key={name}
            >
              <span>{name}</span>
              <span className="text-muted tabular-nums">{amount}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-band px-5 py-14 text-on-band sm:px-8" id="kom-i-gang">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="text-2xl font-semibold tracking-tight">Start med neste uke</h2>
          <p className="mt-2 max-w-xl text-on-band-muted">
            Opprett en konto og sett den første menyen sammen.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className={`inline-flex ${primaryButtonClassName}`} to="/register">
              Opprett konto
            </Link>
            <Link className={bandButtonClassName} to="/login">
              Logg inn
            </Link>
          </div>
          <p className="mt-8 text-sm text-on-band-quiet">
            Mealplanner · ukeplan, handleliste og butikkmodus for familien.
          </p>
        </div>
      </section>
    </main>
  );
}
