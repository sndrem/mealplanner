import {
  dateRangesOverlap,
  getCalendarWeekBounds,
  getNextCalendarWeekBounds,
  type CalendarWeekBounds,
} from "./meal-plan-week";

export const STORE_OFFER_BRIEFING_TITLE_MAX_LENGTH = 120;
export const STORE_OFFER_BRIEFING_SUBTITLE_MAX_LENGTH = 200;
export const STORE_OFFER_BRIEFING_CONTENT_MAX_LENGTH = 4000;

export const STORE_OFFER_BRIEFING_EXPIRED_MESSAGE =
  "Tilbudene for denne uken er ute";

export const PUBLISH_STORE_OFFER_BRIEFING_DESCRIPTION =
  "Publish the weekly store-offer briefing for this family. Replaces any briefing already stored for the same week. weekStart and weekEnd are optional and default to next Europe/Oslo Monday–Sunday. Always send exactly three texts. title: one short line that names the best main store. Example: Rema 1000 er beste hovedbutikk. subtitle: one line on when to shop and when offers expire. Example: De fleste tilbudene går ut lørdag 17. okt (Kiwi søndag 18.). Handle i helgen. content: the full findings as plain text. Start with a short planning paragraph. Then one block per store: the store name on its own line, then one offer per line (product, price, what it is for). End with one line for items that have no offer. Separate blocks with a blank line. Do not use HTML or Markdown. This does not change shopping items, preferred stores, or the selected store.";

const WEEK_PAIR_MESSAGE =
  "Oppgi både ukestart og ukeslutt, eller ingen av dem.";
const INVALID_WEEK_MESSAGE =
  "Uken må være en kalenderuke fra mandag til søndag.";
const EMPTY_TEXT_MESSAGE = "Tittel, undertittel og innhold må fylles ut.";

export type StoreOfferBriefingRecord = {
  content: string;
  id: string;
  subtitle: string;
  title: string;
  updatedAt: string;
  weekEnd: string;
  weekStart: string;
};

export type LoudStoreOfferBriefing = {
  briefing: StoreOfferBriefingRecord;
  kind: "loud";
};

export type QuietStoreOfferBriefing = {
  kind: "quiet";
  message: string;
};

export type StoreOfferBriefingSelection =
  | LoudStoreOfferBriefing
  | QuietStoreOfferBriefing
  | { kind: "hidden" };

type FocusedSpan = {
  end: string;
  start: string;
};

export function parseStoreOfferBriefingText(input: {
  content: string;
  subtitle: string;
  title: string;
}) {
  const title = input.title.trim();
  const subtitle = input.subtitle.trim();
  const content = input.content.trim();

  if (!title || !subtitle || !content) {
    return {
      formError: EMPTY_TEXT_MESSAGE,
      ok: false as const,
    };
  }

  if (title.length > STORE_OFFER_BRIEFING_TITLE_MAX_LENGTH) {
    return {
      formError: `Tittelen kan være maks ${STORE_OFFER_BRIEFING_TITLE_MAX_LENGTH} tegn.`,
      ok: false as const,
    };
  }

  if (subtitle.length > STORE_OFFER_BRIEFING_SUBTITLE_MAX_LENGTH) {
    return {
      formError: `Undertittelen kan være maks ${STORE_OFFER_BRIEFING_SUBTITLE_MAX_LENGTH} tegn.`,
      ok: false as const,
    };
  }

  if (content.length > STORE_OFFER_BRIEFING_CONTENT_MAX_LENGTH) {
    return {
      formError: `Innholdet kan være maks ${STORE_OFFER_BRIEFING_CONTENT_MAX_LENGTH} tegn.`,
      ok: false as const,
    };
  }

  return {
    content,
    ok: true as const,
    subtitle,
    title,
  };
}

export function resolveStoreOfferBriefingWeek({
  referenceDate = new Date(),
  weekEnd,
  weekStart,
}: {
  referenceDate?: Date;
  weekEnd?: string;
  weekStart?: string;
}) {
  const trimmedStart = weekStart?.trim() ?? "";
  const trimmedEnd = weekEnd?.trim() ?? "";
  const hasStart = trimmedStart.length > 0;
  const hasEnd = trimmedEnd.length > 0;

  if (hasStart !== hasEnd) {
    return {
      formError: WEEK_PAIR_MESSAGE,
      ok: false as const,
    };
  }

  if (!hasStart) {
    return {
      ok: true as const,
      ...getNextCalendarWeekBounds(referenceDate),
    };
  }

  if (!isValidDateOnly(trimmedStart) || !isValidDateOnly(trimmedEnd)) {
    return {
      formError: INVALID_WEEK_MESSAGE,
      ok: false as const,
    };
  }

  const calendarWeek = getCalendarWeekBounds(
    new Date(`${trimmedStart}T12:00:00.000Z`),
  );

  if (
    calendarWeek.weekStart !== trimmedStart ||
    calendarWeek.weekEnd !== trimmedEnd
  ) {
    return {
      formError: INVALID_WEEK_MESSAGE,
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    weekEnd: trimmedEnd,
    weekStart: trimmedStart,
  };
}

export function selectStoreOfferBriefing({
  briefings,
  focusedDates,
  nextWeek,
  today,
}: {
  briefings: StoreOfferBriefingRecord[];
  focusedDates: string[];
  nextWeek: CalendarWeekBounds;
  today: string;
}): StoreOfferBriefingSelection {
  const focusedSpan = getFocusedSpan(focusedDates);
  const loud = briefings.filter(
    (briefing) =>
      briefing.weekEnd >= today &&
      (isNextCalendarWeek(briefing, nextWeek) ||
        spansOverlap(briefing, focusedSpan)),
  );

  if (loud.length > 0) {
    return {
      briefing: preferLoudBriefing(loud, focusedSpan),
      kind: "loud",
    };
  }

  const expired = briefings.filter(
    (briefing) =>
      briefing.weekEnd < today && spansOverlap(briefing, focusedSpan),
  );

  if (expired.length === 0) {
    return { kind: "hidden" };
  }

  return {
    kind: "quiet",
    message: STORE_OFFER_BRIEFING_EXPIRED_MESSAGE,
  };
}

function preferLoudBriefing(
  briefings: StoreOfferBriefingRecord[],
  focusedSpan: FocusedSpan | null,
) {
  const containing = focusedSpan
    ? briefings.filter((briefing) => containsSpan(briefing, focusedSpan))
    : [];
  const candidates = containing.length > 0 ? containing : briefings;

  return [...candidates].sort(compareByWeekEnd)[0]!;
}

function compareByWeekEnd(
  left: StoreOfferBriefingRecord,
  right: StoreOfferBriefingRecord,
) {
  const byEnd = left.weekEnd.localeCompare(right.weekEnd);

  if (byEnd !== 0) {
    return byEnd;
  }

  return left.weekStart.localeCompare(right.weekStart);
}

function isNextCalendarWeek(
  briefing: StoreOfferBriefingRecord,
  nextWeek: CalendarWeekBounds,
) {
  return (
    briefing.weekStart === nextWeek.weekStart &&
    briefing.weekEnd === nextWeek.weekEnd
  );
}

function spansOverlap(
  briefing: StoreOfferBriefingRecord,
  focusedSpan: FocusedSpan | null,
) {
  if (!focusedSpan) {
    return false;
  }

  return dateRangesOverlap(
    briefing.weekStart,
    briefing.weekEnd,
    focusedSpan.start,
    focusedSpan.end,
  );
}

function containsSpan(
  briefing: StoreOfferBriefingRecord,
  focusedSpan: FocusedSpan,
) {
  return (
    briefing.weekStart <= focusedSpan.start &&
    briefing.weekEnd >= focusedSpan.end
  );
}

function getFocusedSpan(focusedDates: string[]): FocusedSpan | null {
  if (focusedDates.length === 0) {
    return null;
  }

  const sorted = [...focusedDates].sort();

  return {
    end: sorted[sorted.length - 1]!,
    start: sorted[0]!,
  };
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}
