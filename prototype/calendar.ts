export interface CalendarEventInput {
  title: string;
  date: string;
  description?: string;
}

export function createCalendarFile(
  calendarName: string,
  events: CalendarEventInput[],
): string {
  let stamp = formatDateTimeStamp(new Date());
  let body = events
    .map((event, index) => {
      let start = formatIcsDate(event.date);
      let end = formatIcsDate(addOneDay(event.date));

      return [
        "BEGIN:VEVENT",
        `UID:${escapeText(`${start}-${index}@mealplanner-prototype`)}`,
        `DTSTAMP:${stamp}`,
        `SUMMARY:${escapeText(event.title)}`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${end}`,
        event.description ? `DESCRIPTION:${escapeText(event.description)}` : undefined,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mealplanner Prototype//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    body,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadCalendarFile(fileName: string, content: string) {
  let blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  let url = URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatIcsDate(value: string) {
  return value.replaceAll("-", "");
}

function addOneDay(value: string) {
  let [year, month, day] = value.split("-").map(Number);
  let date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);

  let nextYear = date.getFullYear();
  let nextMonth = `${date.getMonth() + 1}`.padStart(2, "0");
  let nextDay = `${date.getDate()}`.padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function formatDateTimeStamp(value: Date) {
  let year = value.getUTCFullYear();
  let month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  let day = `${value.getUTCDate()}`.padStart(2, "0");
  let hours = `${value.getUTCHours()}`.padStart(2, "0");
  let minutes = `${value.getUTCMinutes()}`.padStart(2, "0");
  let seconds = `${value.getUTCSeconds()}`.padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}
