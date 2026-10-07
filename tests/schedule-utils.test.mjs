import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSlots,
  displayMeeting,
  displaySlot,
  formatDate,
  formatTime,
  getBestTimes,
  localDate,
} from "../src/utils/schedule.mjs";

const baseEvent = {
  dates: ["2026-10-08"],
  startTime: "09:00",
  endTime: "11:00",
  duration: 60,
  participants: [],
};
const slot = (time, date = "2026-10-08") => `${date}@${time}`;

test("slots respect exclusive end, date order and duplicates", () => {
  const slots = buildSlots({
    ...baseEvent,
    dates: ["2026-10-09", "2026-10-08", "2026-10-09"],
  });
  assert.equal(slots.length, 8);
  assert.deepEqual(slots[0], {
    key: slot("09:00"),
    date: "2026-10-08",
    time: "09:00",
    endTime: "09:30",
  });
  assert.equal(slots[3].endTime, "11:00");
  assert.equal(slots[4].date, "2026-10-09");
  assert.deepEqual(buildSlots({ ...baseEvent, endTime: "08:00" }), []);
  assert.deepEqual(buildSlots({ ...baseEvent, startTime: "bad" }), []);
});

test("time formatting handles noon and midnight and end-of-day slots", () => {
  assert.equal(formatTime("00:00"), "12:00 AM");
  assert.equal(formatTime("12:00"), "12:00 PM");
  assert.equal(formatTime("13:30"), "1:30 PM");
  assert.equal(formatTime("24:00"), "12:00 AM");
  assert.equal(
    buildSlots({ ...baseEvent, startTime: "23:00", endTime: "24:00" }).at(-1)
      .endTime,
    "24:00"
  );
});

test("calendar labels and local dates preserve date fields", () => {
  assert.equal(formatDate("2026-10-08"), "Thu, Oct 8");
  assert.equal(formatDate("2026-10-08", { weekday: "long" }), "Thursday");
  const date = new Date(2026, 9, 8, 23, 59);
  assert.equal(localDate(date), "2026-10-08");
});

test("meeting windows intersect participants across every contiguous slot", () => {
  const event = {
    ...baseEvent,
    participants: [
      { id: "a", name: "A", slots: [slot("09:00"), slot("09:30")] },
      {
        id: "b",
        name: "B",
        slots: [slot("09:30"), slot("10:00"), slot("10:30")],
      },
      { id: "c", name: "C", slots: [slot("10:00"), slot("10:30")] },
    ],
  };
  const best = getBestTimes(event);
  assert.deepEqual(
    best.map(({ startTime, count }) => ({ startTime, count })),
    [
      { startTime: "10:00", count: 2 },
      { startTime: "09:00", count: 1 },
    ]
  );
  assert.deepEqual(
    best[0].participants.map(({ id }) => id),
    ["b", "c"]
  );
  assert.equal(best[0].endTime, "11:00");
});

test("equal slot counts do not imply shared meeting availability", () => {
  const event = {
    ...baseEvent,
    endTime: "10:00",
    participants: [
      { id: "a", slots: [slot("09:00")] },
      { id: "b", slots: [slot("09:30")] },
    ],
  };
  assert.deepEqual(getBestTimes(event), []);
});

test("best times avoid overlapping suggestions, cap five, and honor duration", () => {
  const event = { ...baseEvent, endTime: "17:00", participants: [] };
  event.participants = [
    { id: "a", slots: buildSlots(event).map(({ key }) => key) },
  ];
  const best = getBestTimes(event);
  assert.equal(best.length, 5);
  assert.deepEqual(
    best.map(({ startTime }) => startTime),
    ["09:00", "10:00", "11:00", "12:00", "13:00"]
  );
  assert.equal(getBestTimes({ ...event, duration: 120 })[0].endTime, "11:00");
  assert.deepEqual(getBestTimes({ ...event, duration: 600 }), []);
  assert.deepEqual(getBestTimes(baseEvent), []);
});

const zonedSlot = (date, time) => ({
  key: slot(time, date),
  date,
  time,
});

const meetingFields = ({ date, startTime, endDate, endTime }) => ({
  date,
  startTime,
  endDate,
  endTime,
});

test("viewing a slot in another timezone preserves its key across year boundaries", () => {
  const source = zonedSlot("2026-01-01", "00:30");
  const displayed = displaySlot(
    source,
    "America/New_York",
    "America/Los_Angeles"
  );
  assert.equal(displayed.key, source.key);
  assert.equal(displayed.date, "2025-12-31");
  assert.equal(displayed.time, "21:30");
  assert.equal(displayed.endDate, "2025-12-31");
  assert.equal(displayed.endTime, "22:00");
  assert.equal(displayed.instant, Date.parse("2026-01-01T05:30:00Z"));
});

test("timezone conversion handles next-day and quarter-hour offsets", () => {
  const tokyo = displaySlot(
    zonedSlot("2026-10-08", "20:00"),
    "America/New_York",
    "Asia/Tokyo"
  );
  assert.equal(tokyo.date, "2026-10-09");
  assert.equal(tokyo.time, "09:00");
  assert.equal(tokyo.endTime, "09:30");

  const kathmandu = displaySlot(
    zonedSlot("2026-01-08", "09:00"),
    "America/New_York",
    "Asia/Kathmandu"
  );
  assert.equal(kathmandu.date, "2026-01-08");
  assert.equal(kathmandu.time, "19:45");
  assert.equal(kathmandu.endTime, "20:15");
});

test("source timezone offsets follow the event date rather than today's offset", () => {
  const winter = displaySlot(
    zonedSlot("2026-01-08", "09:00"),
    "America/New_York",
    "UTC"
  );
  const summer = displaySlot(
    zonedSlot("2026-07-08", "09:00"),
    "America/New_York",
    "UTC"
  );
  assert.equal(winter.time, "14:00");
  assert.equal(winter.instant, Date.parse("2026-01-08T14:00:00Z"));
  assert.equal(summer.time, "13:00");
  assert.equal(summer.instant, Date.parse("2026-07-08T13:00:00Z"));
});

test("spring-forward slots omit nonexistent local times and retain real 30-minute ends", () => {
  const event = {
    ...baseEvent,
    dates: ["2026-03-08"],
    startTime: "01:00",
    endTime: "04:00",
    timezone: "America/New_York",
  };
  assert.deepEqual(
    buildSlots(event).map(({ time }) => time),
    ["01:00", "01:30", "03:00", "03:30"]
  );
  for (const time of ["02:00", "02:30"]) {
    assert.equal(
      displaySlot(zonedSlot("2026-03-08", time), event.timezone, "UTC"),
      null
    );
  }
  const beforeGap = displaySlot(
    zonedSlot("2026-03-08", "01:30"),
    event.timezone,
    event.timezone
  );
  assert.equal(beforeGap.time, "01:30");
  assert.equal(beforeGap.endTime, "03:00");
  assert.equal(beforeGap.instant, Date.parse("2026-03-08T06:30:00Z"));
  assert.equal(buildSlots({ ...event, timezone: undefined }).length, 6);
});

test("ambiguous source times select the earliest occurrence consistently", () => {
  const displayed = displaySlot(
    zonedSlot("2026-11-01", "01:00"),
    "America/New_York",
    "UTC"
  );
  assert.equal(displayed.time, "05:00");
  assert.equal(displayed.endTime, "05:30");
  assert.equal(displayed.instant, Date.parse("2026-11-01T05:00:00Z"));
});

test("repeated viewer times retain distinct canonical keys and instants", () => {
  const early = displaySlot(
    zonedSlot("2026-11-01", "05:00"),
    "UTC",
    "America/New_York"
  );
  const late = displaySlot(
    zonedSlot("2026-11-01", "06:00"),
    "UTC",
    "America/New_York"
  );
  assert.equal(early.date, late.date);
  assert.equal(early.time, "01:00");
  assert.equal(late.time, "01:00");
  assert.notEqual(early.key, late.key);
  assert.equal(late.instant - early.instant, 60 * 60 * 1000);
});

test("repeated viewer rows identify the actual start and length of the repeated interval", () => {
  const newYork = displaySlot(
    zonedSlot("2026-11-01", "06:30"),
    "UTC",
    "America/New_York"
  );
  assert.equal(newYork.date, "2026-11-01");
  assert.equal(newYork.time, "01:30");
  assert.equal(newYork.repeated, true);
  assert.equal(newYork.repeatStartMinute, 60);
  assert.equal(newYork.repeatMinutes, 60);

  const lordHowe = displaySlot(
    zonedSlot("2026-04-04", "15:00"),
    "UTC",
    "Australia/Lord_Howe"
  );
  assert.equal(lordHowe.date, "2026-04-05");
  assert.equal(lordHowe.time, "01:30");
  assert.equal(lordHowe.repeated, true);
  assert.equal(lordHowe.repeatStartMinute, 90);
  assert.equal(lordHowe.repeatMinutes, 30);
});

test("meeting windows cross the spring-forward gap using elapsed time and shared participants", () => {
  const date = "2026-03-08";
  const participant = {
    id: "both",
    slots: [slot("01:30", date), slot("03:00", date)],
  };
  const event = {
    ...baseEvent,
    dates: [date],
    startTime: "01:30",
    endTime: "03:30",
    timezone: "America/New_York",
    participants: [
      participant,
      { id: "before", slots: [slot("01:30", date)] },
      { id: "after", slots: [slot("03:00", date)] },
    ],
  };
  const best = getBestTimes(event);
  assert.equal(best.length, 1);
  assert.equal(best[0].date, date);
  assert.equal(best[0].startTime, "01:30");
  assert.equal(best[0].endTime, "03:30");
  assert.equal(best[0].count, 1);
  assert.deepEqual(best[0].participants, [participant]);
  assert.equal(best[0].instant, Date.parse("2026-03-08T06:30:00Z"));
  assert.equal(best[0].endInstant - best[0].instant, 60 * 60 * 1000);
  assert.deepEqual(
    meetingFields(displayMeeting(best[0], event.timezone, "UTC")),
    {
      date,
      startTime: "06:30",
      endDate: date,
      endTime: "07:30",
    }
  );
});

test("fall-back wall-clock neighbors cannot bridge an unavailable real hour", () => {
  const date = "2026-11-01";
  const event = {
    ...baseEvent,
    dates: [date],
    startTime: "01:30",
    endTime: "02:30",
    timezone: "America/New_York",
    participants: [
      { id: "a", slots: [slot("01:30", date), slot("02:00", date)] },
    ],
  };
  assert.deepEqual(getBestTimes(event), []);
});

test("fall-back meetings retain the real end instant when the end label repeats", () => {
  const date = "2026-11-01";
  const event = {
    ...baseEvent,
    dates: [date],
    startTime: "01:00",
    endTime: "02:00",
    timezone: "America/New_York",
    participants: [
      { id: "a", slots: [slot("01:00", date), slot("01:30", date)] },
    ],
  };
  const best = getBestTimes(event);
  assert.equal(best.length, 1);
  assert.equal(best[0].startTime, "01:00");
  assert.equal(best[0].endTime, "01:00");
  assert.equal(best[0].instant, Date.parse("2026-11-01T05:00:00Z"));
  assert.equal(best[0].endInstant, Date.parse("2026-11-01T06:00:00Z"));
  assert.deepEqual(
    meetingFields(displayMeeting(best[0], event.timezone, "UTC")),
    {
      date,
      startTime: "05:00",
      endDate: date,
      endTime: "06:00",
    }
  );
  assert.deepEqual(
    meetingFields(displayMeeting(best[0], event.timezone, event.timezone)),
    {
      date,
      startTime: "01:00",
      endDate: date,
      endTime: "01:00",
    }
  );
});

test("meeting display supports older local-field candidates across date boundaries", () => {
  assert.deepEqual(
    meetingFields(
      displayMeeting(
        { date: "2026-01-01", startTime: "00:30", endTime: "01:30" },
        "America/New_York",
        "America/Los_Angeles"
      )
    ),
    {
      date: "2025-12-31",
      startTime: "21:30",
      endDate: "2025-12-31",
      endTime: "22:30",
    }
  );
});

test("new quarter-hour grids retain legacy half-hour defaults and exclusive endpoints", () => {
  const quarterHours = buildSlots({ ...baseEvent, slotMinutes: 15 });
  assert.equal(quarterHours.length, 8);
  assert.deepEqual(
    quarterHours.slice(0, 4).map(({ time, endTime }) => [time, endTime]),
    [
      ["09:00", "09:15"],
      ["09:15", "09:30"],
      ["09:30", "09:45"],
      ["09:45", "10:00"],
    ]
  );
  assert.equal(quarterHours.at(-1).endTime, "11:00");
  assert.deepEqual(
    buildSlots(baseEvent).map(({ time }) => time),
    ["09:00", "09:30", "10:00", "10:30"]
  );
  assert.deepEqual(buildSlots({ ...baseEvent, slotMinutes: 0 }), []);
});

test("displayed quarter-hour cells keep their elapsed length through midnight", () => {
  const source = buildSlots({
    ...baseEvent,
    slotMinutes: 15,
    startTime: "23:45",
    endTime: "24:00",
  })[0];
  const displayed = displaySlot(source, "UTC", "UTC");
  assert.equal(displayed.time, "23:45");
  assert.equal(displayed.endDate, "2026-10-09");
  assert.equal(displayed.endTime, "00:00");
  assert.equal(
    displaySlot(quarterHourSlot(), "America/New_York", "America/Los_Angeles")
      .endTime,
    "06:15"
  );
});

function quarterHourSlot() {
  return buildSlots({ ...baseEvent, slotMinutes: 15 })[0];
}

test("quarter-hour availability supports 15-minute, 45-minute and eight-hour meetings", () => {
  const event = { ...baseEvent, slotMinutes: 15, endTime: "17:00" };
  event.participants = [
    { id: "all", slots: buildSlots(event).map(({ key }) => key) },
  ];
  for (const [duration, expectedEnd] of [
    [15, "09:15"],
    [45, "09:45"],
    [480, "17:00"],
  ]) {
    const best = getBestTimes({ ...event, duration });
    assert.equal(best[0].startTime, "09:00");
    assert.equal(best[0].endTime, expectedEnd);
    assert.equal(best[0].endInstant - best[0].instant, duration * 60_000);
    if (duration === 480) assert.equal(best.length, 1);
  }
});

test("custom 20-minute meetings require availability in their partial final cell", () => {
  const event = {
    ...baseEvent,
    slotMinutes: 15,
    duration: 20,
    endTime: "09:30",
    participants: [{ id: "first", slots: [slot("09:00")] }],
  };
  assert.deepEqual(getBestTimes(event), []);
  event.participants.push({
    id: "both",
    slots: [slot("09:00"), slot("09:15")],
  });
  const best = getBestTimes(event);
  assert.equal(best.length, 1);
  assert.equal(best[0].endTime, "09:20");
  assert.deepEqual(
    best[0].participants.map(({ id }) => id),
    ["both"]
  );
});

test("custom 50-minute meetings cover the final five minutes without rounding the endpoint", () => {
  const event = {
    ...baseEvent,
    slotMinutes: 15,
    duration: 50,
    endTime: "10:00",
    participants: [
      { id: "short", slots: [slot("09:00"), slot("09:15"), slot("09:30")] },
      {
        id: "full",
        slots: [slot("09:00"), slot("09:15"), slot("09:30"), slot("09:45")],
      },
    ],
  };
  const best = getBestTimes(event);
  assert.equal(best.length, 1);
  assert.equal(best[0].endTime, "09:50");
  assert.equal(best[0].endInstant - best[0].instant, 50 * 60_000);
  assert.deepEqual(
    best[0].participants.map(({ id }) => id),
    ["full"]
  );
});

test("legacy grids support custom durations while keeping half-hour start choices", () => {
  const event = {
    ...baseEvent,
    duration: 45,
    endTime: "10:00",
    participants: [{ id: "a", slots: [slot("09:00"), slot("09:30")] }],
  };
  const best = getBestTimes(event);
  assert.equal(best.length, 1);
  assert.equal(best[0].startTime, "09:00");
  assert.equal(best[0].endTime, "09:45");
  assert.ok(!buildSlots(event).some(({ time }) => time === "09:15"));
});

test("duration bounds allow one minute and a full day but reject invalid values", () => {
  const event = {
    ...baseEvent,
    slotMinutes: 15,
    startTime: "00:00",
    endTime: "24:00",
  };
  event.participants = [
    { id: "a", slots: buildSlots(event).map(({ key }) => key) },
  ];
  assert.equal(getBestTimes({ ...event, duration: 1 })[0].endTime, "00:01");
  const fullDay = getBestTimes({ ...event, duration: 1440 });
  assert.equal(fullDay.length, 1);
  assert.equal(fullDay[0].endDate, "2026-10-09");
  assert.equal(fullDay[0].endTime, "00:00");
  for (const duration of [0, -1, 1.5, 1441]) {
    assert.deepEqual(getBestTimes({ ...event, duration }), []);
  }
});

test("quarter-hour slots and custom meeting ends stay continuous through spring DST", () => {
  const date = "2026-03-08";
  const event = {
    ...baseEvent,
    dates: [date],
    slotMinutes: 15,
    startTime: "01:45",
    endTime: "03:15",
    duration: 20,
    timezone: "America/New_York",
    participants: [
      { id: "a", slots: [slot("01:45", date), slot("03:00", date)] },
    ],
  };
  const slots = buildSlots(event);
  assert.deepEqual(
    slots.map(({ time }) => time),
    ["01:45", "03:00"]
  );
  assert.equal(
    displaySlot(slots[0], event.timezone, event.timezone).endTime,
    "03:00"
  );
  const best = getBestTimes(event);
  assert.equal(best.length, 1);
  assert.equal(best[0].startTime, "01:45");
  assert.equal(best[0].endTime, "03:05");
  assert.equal(best[0].endInstant - best[0].instant, 20 * 60_000);
});
