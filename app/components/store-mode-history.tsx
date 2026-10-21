import { storeModeCountChipClass, storeModeMutedPanelClass } from "../lib/store-mode-theme";

interface StoreModeHistoryEvent {
  actorDisplayName: string;
  checked: boolean;
  id: string;
  itemName: string;
  occurredAt: string;
}

export function StoreModeHistory({ events }: { events: StoreModeHistoryEvent[] }) {
  return (
    <details className={storeModeMutedPanelClass}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-semibold tracking-tight text-store-ink">
          Handlehistorikk
        </span>
        <span className={storeModeCountChipClass}>{events.length} hendelser</span>
      </summary>
      {events.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {events.map((event) => (
            <StoreModeHistoryEventRow event={event} key={event.id} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-store-muted">
          Ingen handlehistorikk for denne turen ennå.
        </p>
      )}
    </details>
  );
}

function StoreModeHistoryEventRow({ event }: { event: StoreModeHistoryEvent }) {
  return (
    <li className="border-t border-store-line/80 pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm leading-6 text-store-ink">
        <span className="font-medium text-store-ink">
          {event.actorDisplayName}
        </span>
        {event.checked ? " krysset av " : " fjernet avkryssing for "}
        <span className="font-medium text-store-ink">{event.itemName}</span>
      </p>
      <p className="mt-0.5 text-xs leading-5 text-store-muted">
        {formatHistoryTimestamp(event.occurredAt)}
      </p>
    </li>
  );
}

function formatHistoryTimestamp(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
