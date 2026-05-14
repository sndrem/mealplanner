import { requireUser } from "../lib/auth.server";
import { getMealPlanCalendarExport } from "../lib/calendar.server";

export async function loader({
  params,
  request,
}: {
  params: {
    familyId?: string;
    mealPlanId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const mealPlanId = requireRouteParam(params.mealPlanId, "Fant ikke ukeplanen.");
  const result = await getMealPlanCalendarExport({
    familyId,
    mealPlanId,
    userId: user.id,
  });

  return buildCalendarResponse(result.fileName, result.content);
}

function buildCalendarResponse(fileName: string, content: string) {
  return new Response(content, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}

function requireRouteParam(value: string | undefined, message: string) {
  if (!value) {
    throw new Response(message, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return value;
}
