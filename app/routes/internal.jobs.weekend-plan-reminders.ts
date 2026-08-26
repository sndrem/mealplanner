import { env } from "../lib/env.server";
import {
  isCronAuthorizationValid,
  runWeekendPlanReminders,
} from "../lib/weekend-plan-reminder.server";

export async function loader() {
  throw new Response("Method Not Allowed", {
    status: 405,
    statusText: "Method Not Allowed",
  });
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    throw new Response("Method Not Allowed", {
      status: 405,
      statusText: "Method Not Allowed",
    });
  }

  const cronSecret = env.CRON_SECRET;

  if (!cronSecret) {
    return new Response("Cron is not configured.", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }

  if (
    !isCronAuthorizationValid({
      authorizationHeader: request.headers.get("Authorization"),
      cronSecret,
    })
  ) {
    return new Response("Unauthorized", {
      status: 401,
      statusText: "Unauthorized",
    });
  }

  const url = new URL(request.url);
  const force =
    url.searchParams.get("force") === "true" ||
    request.headers.get("X-Cron-Force") === "true";
  const result = await runWeekendPlanReminders({
    force,
    origin: url.origin,
  });

  return Response.json(result);
}
