import { type ReactNode, useCallback, useId, useRef } from "react";
import { Link, useLocation } from "react-router";

export type FamilyHomeTab = "familie" | "oversikt";

const TAB_ORDER: FamilyHomeTab[] = ["oversikt", "familie"];

function buildTabHref(pathname: string, search: string, tab: FamilyHomeTab) {
  const params = new URLSearchParams(search);

  if (tab === "oversikt") {
    params.delete("tab");
  } else {
    params.set("tab", tab);
  }

  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}

function tabTriggerClassName(isActive: boolean) {
  return isActive
    ? "rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm"
    : "rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950";
}

export function FamilyHomeTabs({
  activeTab,
  familiePanel,
  oversiktPanel,
}: {
  activeTab: FamilyHomeTab;
  familiePanel: ReactNode;
  oversiktPanel: ReactNode;
}) {
  const location = useLocation();
  const tabListId = useId();
  const tabRefs = useRef<Partial<Record<FamilyHomeTab, HTMLAnchorElement | null>>>({});

  const focusTab = useCallback((tab: FamilyHomeTab) => {
    tabRefs.current[tab]?.focus();
  }, []);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLAnchorElement>, tab: FamilyHomeTab) => {
      const currentIndex = TAB_ORDER.indexOf(tab);

      if (currentIndex === -1) {
        return;
      }

      let nextTab: FamilyHomeTab | null = null;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextTab = TAB_ORDER[(currentIndex + 1) % TAB_ORDER.length] ?? null;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextTab =
          TAB_ORDER[(currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length] ?? null;
      } else if (event.key === "Home") {
        nextTab = TAB_ORDER[0] ?? null;
      } else if (event.key === "End") {
        nextTab = TAB_ORDER[TAB_ORDER.length - 1] ?? null;
      }

      if (!nextTab) {
        return;
      }

      event.preventDefault();
      focusTab(nextTab);
    },
    [focusTab],
  );

  const tabs: { href: string; id: string; label: string; panelId: string; tab: FamilyHomeTab }[] =
    [
      {
        href: buildTabHref(location.pathname, location.search, "oversikt"),
        id: `${tabListId}-oversikt-tab`,
        label: "Oversikt",
        panelId: `${tabListId}-oversikt-panel`,
        tab: "oversikt",
      },
      {
        href: buildTabHref(location.pathname, location.search, "familie"),
        id: `${tabListId}-familie-tab`,
        label: "Familie",
        panelId: `${tabListId}-familie-panel`,
        tab: "familie",
      },
    ];

  return (
    <div className="flex flex-col gap-6">
      <div
        aria-label="Familieoversikt"
        className="inline-flex w-fit max-w-full flex-wrap gap-2 rounded-[28px] bg-white p-2 shadow-sm ring-1 ring-slate-200"
        role="tablist"
      >
        {tabs.map(({ href, id, label, panelId, tab }) => {
          const isActive = activeTab === tab;

          return (
            <Link
              key={tab}
              ref={(element) => {
                tabRefs.current[tab] = element;
              }}
              aria-controls={panelId}
              aria-selected={isActive}
              className={tabTriggerClassName(isActive)}
              id={id}
              onKeyDown={(event) => handleTabKeyDown(event, tab)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              to={href}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {tabs.map(({ id, panelId, tab }) => {
        const isActive = activeTab === tab;

        return (
          <section
            key={tab}
            aria-labelledby={id}
            className={isActive ? "flex flex-col gap-6" : "hidden"}
            id={panelId}
            role="tabpanel"
            tabIndex={0}
          >
            {tab === "oversikt" ? oversiktPanel : familiePanel}
          </section>
        );
      })}
    </div>
  );
}
