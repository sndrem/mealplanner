import { useEffect, useId, useState } from "react";
import { Link, NavLink } from "react-router";

interface NavItem {
  end?: boolean;
  label: string;
  to: string;
}

function buildFamilyNavItems(
  familyId: string,
  pendingReviewCount: number,
): NavItem[] {
  const reviewLabel =
    pendingReviewCount > 0
      ? `Gjennomgang (${pendingReviewCount})`
      : "Gjennomgang";

  return [
    { end: true, label: "Familie", to: `/families/${familyId}` },
    { end: false, label: "Ukeplaner", to: `/families/${familyId}/meal-plans` },
    {
      end: true,
      label: reviewLabel,
      to: `/families/${familyId}/meal-plans/reviews`,
    },
    {
      end: true,
      label: "Handleliste",
      to: `/families/${familyId}/store-mode`,
    },
    { end: true, label: "Butikker", to: `/families/${familyId}/stores` },
    { end: true, label: "Kassalapp", to: `/families/${familyId}/kassalapp` },
    { end: false, label: "Oppskrifter", to: `/families/${familyId}/recipes` },
    {
      end: true,
      label: "Basisvarer",
      to: `/families/${familyId}/stock-ingredients`,
    },
    { end: true, label: "Oversikt", to: "/app" },
  ];
}

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return [
    "rounded-2xl px-4 py-2 text-sm font-medium transition",
    isActive
      ? "bg-emerald-500 text-white"
      : "text-slate-200 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

function NavLinks({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          className={navLinkClassName}
          end={item.end}
          onClick={onNavigate}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function AppTopNav({
  familyId,
  pendingReviewCount = 0,
}: {
  familyId: string | null;
  pendingReviewCount?: number;
}) {
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = familyId
    ? buildFamilyNavItems(familyId, pendingReviewCount)
    : [{ end: true, label: "Oversikt", to: "/app" }];

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          aria-label="Mealplanner forsiden"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 transition hover:bg-white/10"
          to="/"
        >
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/20 text-xs font-semibold text-emerald-200"
          >
            MP
          </span>
          <span className="text-sm font-semibold tracking-tight">Mealplanner</span>
        </Link>

        <nav aria-label="Hovedmeny" className="hidden items-center gap-2 md:flex">
          <NavLinks items={navItems} />
        </nav>

        <button
          aria-controls={menuId}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Lukk meny" : "Åpne meny"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-slate-100 transition hover:bg-white/15 md:hidden"
          onClick={() => {
            setMenuOpen((open) => !open);
          }}
          type="button"
        >
          <span aria-hidden className="relative block h-3.5 w-4">
            <span
              className={[
                "absolute left-0 block h-0.5 w-4 rounded-full bg-current transition",
                menuOpen ? "top-1.5 rotate-45" : "top-0",
              ].join(" ")}
            />
            <span
              className={[
                "absolute left-0 top-1.5 block h-0.5 w-4 rounded-full bg-current transition",
                menuOpen ? "opacity-0" : "opacity-100",
              ].join(" ")}
            />
            <span
              className={[
                "absolute left-0 block h-0.5 w-4 rounded-full bg-current transition",
                menuOpen ? "top-1.5 -rotate-45" : "top-3",
              ].join(" ")}
            />
          </span>
        </button>
      </div>

      {menuOpen ? (
        <nav
          aria-label="Hovedmeny mobil"
          className="border-t border-white/10 px-4 py-3 md:hidden"
          id={menuId}
        >
          <div className="flex flex-col gap-2">
            <NavLinks
              items={navItems}
              onNavigate={() => {
                setMenuOpen(false);
              }}
            />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
