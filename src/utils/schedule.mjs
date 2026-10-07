const DEFAULT_SLOT_MINUTES = 30;
const MINUTE_MS = 60_000;
const zoneFormatters = new Map();
const instantCache = new Map();

function zoneFormatter(timezone) {
  if (!zoneFormatters.has(timezone)) {
    zoneFormatters.set(
      timezone,
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        timeZoneName: "short",
      })
    );
  }
  return zoneFormatters.get(timezone);
}

function wallInstant(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return null;
  const midnight = new Date(`${date}T00:00:00.000Z`);
  const minutes = minutesFromTime(time);
  if (
    !Number.isFinite(midnight.getTime()) ||
    midnight.toISOString().slice(0, 10) !== date ||
    !Number.isFinite(minutes)
  )
    return null;
  return midnight.getTime() + minutes * MINUTE_MS;
}

function zonedFields(instant, timezone) {
  const parts = Object.fromEntries(
    zoneFormatter(timezone)
      .formatToParts(instant)
      .map(({ type, value }) => [type, value])
  );
  const date = `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`;
  const time = `${String(Number(parts.hour) % 24).padStart(2, "0")}:${
    parts.minute
  }`;
  return {
    date,
    time,
    zoneLabel: parts.timeZoneName,
    offsetMinutes:
      (wallInstant(date, time) + Number(parts.second) * 1000 - instant) /
      MINUTE_MS,
  };
}

/** Missing wall times are omitted; ambiguous wall times use the first occurrence. */
function localInstant(date, time, timezone = "UTC") {
  const cacheKey = `${timezone}|${date}|${time}`;
  if (instantCache.has(cacheKey)) return instantCache.get(cacheKey);
  const wall = wallInstant(date, time);
  if (wall === null) return null;
  let earliest = null;
  try {
    // Both sides of a nearby clock change supply the possible UTC offsets.
    // This also preserves quarter-hour offsets, without using the current offset.
    const offsets = new Set(
      [-36, -12, 0, 12, 36].map(
        (hours) =>
          zonedFields(wall + hours * 60 * MINUTE_MS, timezone).offsetMinutes
      )
    );
    for (const offset of offsets) {
      const candidate = wall - offset * MINUTE_MS;
      const fields = zonedFields(candidate, timezone);
      if (
        wallInstant(fields.date, fields.time) === wall &&
        (earliest === null || candidate < earliest)
      )
        earliest = candidate;
    }
  } catch {
    return null;
  }
  if (instantCache.size >= 10_000) instantCache.clear();
  instantCache.set(cacheKey, earliest);
  return earliest;
}

function minutesFromTime(time) {
  if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const [hours, minutes] = time.split(":").map(Number);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return NaN;
  return hours * 60 + minutes;
}

function timeFromMinutes(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;
}

function slotMinutesForEvent(event) {
  const minutes = Number(event?.slotMinutes ?? DEFAULT_SLOT_MINUTES);
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 1440
    ? minutes
    : null;
}

/** Calendar dates must use local fields instead of toISOString's UTC date. */
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatTime(time) {
  const minutes = minutesFromTime(time);
  if (!Number.isFinite(minutes)) return time || "";
  const hours = Math.floor(minutes / 60) % 24;
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

/** Parse at local noon so a plain calendar date never shifts with timezone. */
export function formatDate(
  date,
  options = { weekday: "short", month: "short", day: "numeric" }
) {
  const [year, month, day] = String(date).split("-").map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  if (!year || !month || !day || Number.isNaN(parsed.getTime()))
    return date || "";
  return new Intl.DateTimeFormat("en-US", options).format(parsed);
}

export function buildSlots(event) {
  const start = minutesFromTime(event?.startTime);
  const end = minutesFromTime(event?.endTime);
  const slotMinutes = slotMinutesForEvent(event);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    !slotMinutes
  )
    return [];
  return [...new Set(event.dates || [])].sort().flatMap((date) => {
    const slots = [];
    for (
      let minute = start;
      minute + slotMinutes <= end;
      minute += slotMinutes
    ) {
      const time = timeFromMinutes(minute);
      if (event.timezone && localInstant(date, time, event.timezone) === null)
        continue;
      slots.push({
        key: `${date}@${time}`,
        date,
        time,
        endTime: timeFromMinutes(minute + slotMinutes),
      });
    }
    return slots;
  });
}

/** Preserve the API key and advance the slot's length in actual elapsed minutes. */
export function displaySlot(
  slot,
  eventTimezone = "UTC",
  viewTimezone = eventTimezone
) {
  if (!slot) return null;
  const slotMinutes =
    slot.endTime == null
      ? DEFAULT_SLOT_MINUTES
      : minutesFromTime(slot.endTime) - minutesFromTime(slot.time);
  if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) return null;
  const instant = localInstant(slot.date, slot.time, eventTimezone);
  if (instant === null) return null;
  try {
    const start = zonedFields(instant, viewTimezone);
    const end = zonedFields(instant + slotMinutes * MINUTE_MS, viewTimezone);
    const firstOccurrence = localInstant(start.date, start.time, viewTimezone);
    const repeated = firstOccurrence !== null && instant > firstOccurrence;
    let repeatStartMinute = null;
    if (repeated) {
      // Find the clock-change boundary so repeated rows follow the whole first
      // occurrence, including zones that turn back by half an hour.
      let before = firstOccurrence;
      let after = instant;
      const firstOffset = zonedFields(before, viewTimezone).offsetMinutes;
      while (after - before > MINUTE_MS) {
        const middle =
          before + Math.floor((after - before) / MINUTE_MS / 2) * MINUTE_MS;
        if (zonedFields(middle, viewTimezone).offsetMinutes === firstOffset)
          before = middle;
        else after = middle;
      }
      repeatStartMinute = minutesFromTime(
        zonedFields(after, viewTimezone).time
      );
    }
    return {
      key: slot.key,
      date: start.date,
      time: start.time,
      endDate: end.date,
      endTime: end.time,
      instant,
      zoneLabel: start.zoneLabel,
      endZoneLabel: end.zoneLabel,
      repeated,
      repeatStartMinute,
      repeatMinutes:
        firstOccurrence === null ? 0 : (instant - firstOccurrence) / MINUTE_MS,
    };
  } catch {
    return null;
  }
}

/** Convert a ranked meeting's actual interval, including overnight/DST endpoints. */
export function displayMeeting(
  meeting,
  eventTimezone = "UTC",
  viewTimezone = eventTimezone
) {
  if (!meeting) return null;
  const instant = Number.isFinite(meeting.instant)
    ? meeting.instant
    : localInstant(meeting.date, meeting.startTime, eventTimezone);
  const endInstant = Number.isFinite(meeting.endInstant)
    ? meeting.endInstant
    : localInstant(
        meeting.endDate || meeting.date,
        meeting.endTime,
        eventTimezone
      );
  if (instant === null || endInstant === null) return null;
  try {
    const start = zonedFields(instant, viewTimezone);
    const end = zonedFields(endInstant, viewTimezone);
    return {
      date: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      zoneLabel: start.zoneLabel,
      endZoneLabel: end.zoneLabel,
    };
  } catch {
    return null;
  }
}

/** Rank actual continuous meeting windows, using the same people throughout. */
export function getBestTimes(event) {
  const duration = Number(event?.duration ?? 60);
  const slotMinutes = slotMinutesForEvent(event);
  const participants = event?.participants || [];
  if (
    !Number.isInteger(duration) ||
    duration <= 0 ||
    duration > 1440 ||
    !slotMinutes ||
    !participants.length
  )
    return [];
  const timezone = event.timezone || "UTC";
  const slotsByInstant = new Map(
    buildSlots(event)
      .map((slot) => [localInstant(slot.date, slot.time, timezone), slot])
      .filter(([instant]) => instant !== null)
  );
  const participantSlots = participants.map((participant) => ({
    participant,
    slots: new Set(participant.slots || []),
  }));
  const candidates = [...slotsByInstant]
    .flatMap(([instant, slot]) => {
      const keys = [];
      for (let offset = 0; offset < duration; offset += slotMinutes) {
        const nextSlot = slotsByInstant.get(instant + offset * MINUTE_MS);
        if (!nextSlot) return [];
        keys.push(nextSlot.key);
      }
      const available = participantSlots
        .filter(({ slots }) => keys.every((key) => slots.has(key)))
        .map(({ participant }) => participant);
      if (!available.length) return [];
      const endInstant = instant + duration * MINUTE_MS;
      const end = zonedFields(endInstant, timezone);
      return [
        {
          date: slot.date,
          startTime: slot.time,
          endDate: end.date,
          endTime: end.time,
          instant,
          endInstant,
          count: available.length,
          participants: available,
        },
      ];
    })
    .sort((a, b) => b.count - a.count || a.instant - b.instant);

  // Nearby overlapping starts represent the same option. Prefer distinct windows.
  const best = [];
  for (const candidate of candidates) {
    const overlaps = best.some(
      (chosen) =>
        candidate.instant < chosen.endInstant &&
        candidate.endInstant > chosen.instant
    );
    if (!overlaps) best.push(candidate);
    if (best.length === 5) break;
  }
  return best;
}
