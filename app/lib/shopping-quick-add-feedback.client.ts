const QUICK_ADD_ITEM_SELECTOR_ATTRIBUTE = "data-shopping-source-key";

function escapeAttributeValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function buildShoppingItemSourceSelector(sourceKey: string) {
  return `[${QUICK_ADD_ITEM_SELECTOR_ATTRIBUTE}="${escapeAttributeValue(sourceKey)}"]`;
}

export function shouldScrollItemIntoView(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  return rect.top < 0 || rect.bottom > viewportHeight;
}

export function scrollToShoppingItem(sourceKey: string) {
  const selector = buildShoppingItemSourceSelector(sourceKey);
  const item = document.querySelector<HTMLElement>(selector);

  if (!item) {
    return false;
  }

  if (shouldScrollItemIntoView(item)) {
    item.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }

  return true;
}
