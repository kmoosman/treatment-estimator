import test from "node:test";
import assert from "node:assert/strict";
import {
  appendInviteEmails,
  formatInviteEmails,
  getInviteEmails,
  makeMeetingMessage,
} from "../src/utils/scheduleMessages.mjs";

const participants = [
  { id: "a", name: "Alex", email: " Alex@Example.com " },
  { id: "b", name: "Jordan", email: "jordan@example.com" },
  { id: "c", name: "Sam", email: "alex@example.COM" },
  { id: "d", name: "Robin", email: " " },
  { id: "e", name: "Taylor" },
];
const event = {
  title: "Research team catch-up",
  description: "Review next steps",
  participants: participants.slice(0, 3),
};
const meeting = {
  date: "2026-10-08",
  startTime: "10:00",
  endDate: "2026-10-08",
  endTime: "11:00",
  count: 3,
  participants: event.participants,
};

test("invite emails trim blanks and deduplicate case-insensitively without losing first spelling", () => {
  assert.deepEqual(getInviteEmails(participants), [
    "Alex@Example.com",
    "jordan@example.com",
  ]);
  assert.deepEqual(getInviteEmails(), []);
  assert.equal(
    formatInviteEmails(participants),
    "Alex@Example.com, jordan@example.com"
  );
  assert.equal(
    formatInviteEmails(participants, "newline"),
    "Alex@Example.com\njordan@example.com"
  );
});

test("meeting draft uses already-converted dates, year, compact time range and explicit timezone", () => {
  assert.equal(
    makeMeetingMessage(event, meeting, "America/New_York"),
    "We can meet for “Research team catch-up” on Thu, Oct 8, 2026, 10:00–11:00 AM (America/New York). Agenda: Review next steps. Please send calendar invites."
  );
});

test("partial attendance never claims everyone is available", () => {
  const message = makeMeetingMessage(
    event,
    { ...meeting, count: 2 },
    "Europe/London"
  );
  assert.ok(message.startsWith("2 of 3 people can meet"));
  assert.ok(!message.startsWith("We can meet"));
});

test("cross-noon and cross-date ranges retain unambiguous time periods and dates", () => {
  const noon = makeMeetingMessage(
    event,
    { ...meeting, startTime: "11:30", endTime: "12:30" },
    "UTC"
  );
  assert.ok(noon.includes("11:30 AM–12:30 PM"));
  const midnight = makeMeetingMessage(
    event,
    {
      ...meeting,
      date: "2026-12-31",
      startTime: "23:30",
      endDate: "2027-01-01",
      endTime: "00:30",
    },
    "Asia/Tokyo"
  );
  assert.ok(
    midnight.includes("Thu, Dec 31, 2026, 11:30 PM–Fri, Jan 1, 2027, 12:30 AM")
  );
});

test("long agendas are kept brief while optional descriptions produce no filler", () => {
  const long = makeMeetingMessage(
    { ...event, description: "Discussion item ".repeat(100) },
    meeting,
    "UTC"
  );
  const agenda = long.split("Agenda: ")[1].split(" Please send")[0];
  assert.ok(Array.from(agenda).length <= 160);
  assert.ok(agenda.endsWith("…"));
  assert.ok(
    !makeMeetingMessage({ ...event, description: "" }, meeting, "UTC").includes(
      "Agenda:"
    )
  );
});

test("meetings crossing a clock change identify both timezone labels", () => {
  const draft = makeMeetingMessage(
    event,
    {
      ...meeting,
      date: "2026-11-01",
      endDate: "2026-11-01",
      startTime: "01:00",
      endTime: "01:00",
      zoneLabel: "EDT",
      endZoneLabel: "EST",
    },
    "America/New_York"
  );
  assert.ok(draft.includes("1:00 AM EDT–1:00 AM EST (America/New York)"));
});

test("copy with emails includes every submitted address, including people unavailable for the suggestion", () => {
  const partial = {
    ...meeting,
    count: 1,
    participants: [event.participants[0]],
  };
  const draft = makeMeetingMessage(event, partial, "UTC");
  assert.equal(
    appendInviteEmails(draft, participants, "newline"),
    `${draft}\n\nEmails to invite:\nAlex@Example.com\njordan@example.com`
  );
  assert.equal(
    appendInviteEmails("Custom invitation", [], "comma"),
    "Custom invitation"
  );
});
