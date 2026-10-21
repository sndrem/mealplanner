import {
  STORE_MODE_SYNC_PROGRESS_MESSAGE,
} from "../lib/use-store-mode-toggle-sync";
import {
  getStoreModeSyncOverlayClass,
  storeModeSyncOverlayShellClass,
} from "../lib/store-mode-theme";

export function StoreModeSyncOverlay({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  const isSyncing = message === STORE_MODE_SYNC_PROGRESS_MESSAGE;

  return (
    <div
      aria-live="polite"
      className={storeModeSyncOverlayShellClass}
      role="status"
    >
      <div className={getStoreModeSyncOverlayClass(isSyncing ? "sync" : "error")}>
        <p className="font-semibold">
          {isSyncing ? "Synkroniserer" : "Kunne ikke synkronisere"}
        </p>
        <p className="mt-0.5 leading-5">{message}</p>
      </div>
    </div>
  );
}
