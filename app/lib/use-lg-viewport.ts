import { useSyncExternalStore } from "react";

const LG_MEDIA_QUERY = "(min-width: 1024px)";

function subscribe(onStoreChange: () => void) {
  const mediaQueryList = window.matchMedia(LG_MEDIA_QUERY);
  mediaQueryList.addEventListener("change", onStoreChange);

  return () => {
    mediaQueryList.removeEventListener("change", onStoreChange);
  };
}

function getSnapshot() {
  return window.matchMedia(LG_MEDIA_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useIsLgViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
