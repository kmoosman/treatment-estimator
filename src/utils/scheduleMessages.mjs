import { formatTime } from "./schedule.mjs";

export function getInviteEmails(participants = []) {
  const seen = new Set();
  return participants.flatMap((participant) => {
    const email =
      typeof participant?.email === "string" ? participant.email.trim() : "";
    const key = email.toLowerCase();
    if (!email || seen.has(key)) return [];
    seen.add(key);
    return [email];
  });
}

export function formatInviteEmails(participants, separator = "comma") {
  return getInviteEmails(participants).join(
    separator === "newline" ? "\n" : ", "
  );
}

function dateLabel(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date || "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function briefDescription(description) {
  const text = String(description || "")
    .trim()
    .replace(/\s+/gu, " ");
  if (Array.from(text).length <= 160) return text;
  const beginning = Array.from(text).slice(0, 159).join("");
  const lastSpace = beginning.lastIndexOf(" ");
  return `${(lastSpace > 120
    ? beginning.slice(0, lastSpace)
    : beginning
  ).trimEnd()}…`;
}

/** The meeting already contains dates/times in the viewer's selected timezone. */
export function makeMeetingMessage(event, meeting, timezone) {
  const total = event.participants?.length || 0;
  const count = meeting.count ?? meeting.participants?.length ?? 0;
  const who =
    total > 0 && count < total
      ? `${count} of ${total} people can meet`
      : "We can meet";
  const start = formatTime(meeting.startTime);
  const end = formatTime(meeting.endTime);
  const crossesDate = meeting.endDate && meeting.endDate !== meeting.date;
  const changesOffset =
    meeting.zoneLabel &&
    meeting.endZoneLabel &&
    meeting.zoneLabel !== meeting.endZoneLabel;
  const labeledStart = changesOffset ? `${start} ${meeting.zoneLabel}` : start;
  const labeledEnd = changesOffset ? `${end} ${meeting.endZoneLabel}` : end;
  const samePeriod = start.slice(-2) === end.slice(-2);
  const when = crossesDate
    ? `${dateLabel(meeting.date)}, ${labeledStart}–${dateLabel(
        meeting.endDate
      )}, ${labeledEnd}`
    : changesOffset
    ? `${dateLabel(meeting.date)}, ${labeledStart}–${labeledEnd}`
    : `${dateLabel(meeting.date)}, ${
        samePeriod ? start.slice(0, -3) : start
      }–${end}`;
  const zone = String(timezone || event.timezone || "UTC").replaceAll("_", " ");
  const title = String(event.title || "our meeting")
    .trim()
    .replace(/\s+/gu, " ");
  const description = briefDescription(event.description);
  const agenda = description
    ? ` Agenda: ${description}${/[.!?…]$/u.test(description) ? "" : "."}`
    : "";
  return `${who} for “${title}” on ${when} (${zone}).${agenda} Please send calendar invites.`;
}

export function appendInviteEmails(message, participants, separator = "comma") {
  const emails = formatInviteEmails(participants, separator);
  return emails
    ? `${message.trim()}\n\nEmails to invite:\n${emails}`
    : message.trim();
}
