export const STORE_MODE_TRIP_PATH_SUFFIX = "/store-mode";

export function shouldReloadStoreModeTrip({
  currentRevision,
  nextRevision,
}: {
  currentRevision?: string | null;
  nextRevision?: string | null;
}) {
  if (!currentRevision || !nextRevision) {
    return false;
  }

  return currentRevision !== nextRevision;
}

export function shouldRevalidateStoreModeAfterAction({
  currentPathname,
  defaultShouldRevalidate,
  formMethod,
  nextPathname,
}: {
  currentPathname: string;
  defaultShouldRevalidate: boolean;
  formMethod?: string;
  nextPathname: string;
}) {
  if (formMethod && formMethod !== "GET" && currentPathname === nextPathname) {
    return false;
  }

  return defaultShouldRevalidate;
}

export function shouldRevalidateStoreModeParent({
  currentPathname,
  defaultShouldRevalidate,
  formMethod,
  nextPathname,
}: {
  currentPathname: string;
  defaultShouldRevalidate: boolean;
  formMethod?: string;
  nextPathname: string;
}) {
  if (
    !formMethod &&
    currentPathname === nextPathname &&
    currentPathname.endsWith(STORE_MODE_TRIP_PATH_SUFFIX)
  ) {
    return false;
  }

  return defaultShouldRevalidate;
}
