import type { StoreModeNotice } from "./store-mode-action-data";

export function getStoreModeNotice(request: Request): StoreModeNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "family-shopping-item-added" ||
    notice === "generated-shopping-item-marked-as-stock" ||
    notice === "selected-store-updated" ||
    notice === "shopping-item-check-state-updated" ||
    notice === "stock-shopping-items-opted-in" ||
    notice === "store-mode-trip-focus-updated" ||
    notice === "shopping-grocery-grouping-updated"
  ) {
    return notice;
  }

  return null;
}

export function readStoreModeNoticeContent(notice: StoreModeNotice | null) {
  if (!notice) {
    return null;
  }

  return getStoreModeNoticeContent(notice);
}

export function getStoreModeNoticeContent(notice: StoreModeNotice) {
  switch (notice) {
    case "selected-store-updated":
      return {
        description: "Butikkvalget ditt ble lagret for denne familien.",
        title: "Butikkvalg lagret",
      };
    case "store-mode-trip-focus-updated":
      return {
        description: "Fokuset for handleturen ble oppdatert.",
        title: "Fokus lagret",
      };
    case "shopping-grocery-grouping-updated":
      return {
        description: "Visningen av like varer ble oppdatert.",
        title: "Gruppering lagret",
      };
    case "shopping-item-check-state-updated":
      return {
        description: "Avkryssingen for varelinjen ble oppdatert.",
        title: "Vare oppdatert",
      };
    case "family-shopping-item-added":
      return {
        description: "Varen ble lagt til og vises i handlelisten.",
        title: "Vare lagt til",
      };
    case "generated-shopping-item-marked-as-stock":
      return {
        description:
          "Varen holdes utenfor handlelisten fremover. Du kan legge den til for denne turen, eller fjerne den fra Basisvarer.",
        title: "Basisvare lagt til",
      };
    case "stock-shopping-items-opted-in":
      return {
        description:
          "Basisvarene ble lagt til i handlelisten og vises i kategoriene.",
        title: "Basisvarer lagt til",
      };
  }
}
