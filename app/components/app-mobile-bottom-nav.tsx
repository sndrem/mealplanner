import { NavLink, useLocation } from "react-router";

interface MobileBottomNavItem {
  end?: boolean;
  label: string;
  to: string;
}

function buildFamilyBottomNavItems(familyId: string): MobileBottomNavItem[] {
  return [
    { end: true, label: "Familie", to: `/families/${familyId}` },
    {
      end: false,
      label: "Ukeplaner",
      to: `/families/${familyId}/meal-plans`,
    },
    {
      label: "Handleliste",
      to: `/families/${familyId}/store-mode`,
    },
  ];
}

function bottomNavLinkClassName({ isActive }: { isActive: boolean }) {
  return [
    "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-medium transition",
    isActive
      ? "bg-emerald-500/15 text-emerald-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");
}

function isStoreModeShoppingNavActive(pathname: string, familyId: string) {
  return pathname === `/families/${familyId}/store-mode`;
}

export function AppMobileBottomNav({ familyId }: { familyId: string | null }) {
  const location = useLocation();

  if (!familyId) {
    return null;
  }

  const navItems = buildFamilyBottomNavItems(familyId);

  return (
    <nav
      aria-label="Hovednavigasjon mobil"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-6xl gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) =>
              bottomNavLinkClassName({
                isActive:
                  item.label === "Handleliste"
                    ? isStoreModeShoppingNavActive(location.pathname, familyId)
                    : isActive,
              })
            }
            end={item.end}
            to={item.to}
          >
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
