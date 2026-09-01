import { getFamilyCalendarFeedByToken } from "../lib/calendar-subscription.server";

export async function loader({
  params,
}: {
  params: {
    token?: string;
  };
}) {
  const token = params.token?.trim();

  if (!token) {
    throw new Response("Fant ikke kalenderen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const feed = await getFamilyCalendarFeedByToken(token);

  if (!feed) {
    throw new Response("Fant ikke kalenderen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return new Response(feed.content, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": 'inline; filename="mealplanner.ics"',
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
