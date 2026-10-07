/* eslint-env node */
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Buffer } from "node:buffer";

export const UUID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const BODY_LIMIT = 128 * 1024;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireValid(condition, message) {
  if (!condition) throw new ApiError(400, message);
}

function cleanText(value, label, maximum, optional = false) {
  if (optional && value === undefined) return "";
  requireValid(typeof value === "string", `${label} must be text.`);
  const result = value.trim();
  requireValid(optional || result.length > 0, `${label} is required.`);
  requireValid(
    result.length <= maximum,
    `${label} must be ${maximum} characters or fewer.`
  );
  return result;
}

function minutes(value, label, allowMidnight = false) {
  requireValid(typeof value === "string", `${label} is required.`);
  if (allowMidnight && value === "24:00") return 24 * 60;
  requireValid(
    /^([01]\d|2[0-3]):(00|15|30|45)$/.test(value),
    `${label} must use a 15-minute boundary.`
  );
  const [hours, minute] = value.split(":").map(Number);
  return hours * 60 + minute;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function eventInput(body) {
  const title = cleanText(body.title, "Event name", 80);
  const description = cleanText(body.description, "Description", 1000, true);
  requireValid(
    Array.isArray(body.dates) &&
      body.dates.length > 0 &&
      body.dates.length <= 31,
    "Choose between 1 and 31 dates."
  );
  requireValid(body.dates.every(validDate), "Choose valid calendar dates.");
  requireValid(
    new Set(body.dates).size === body.dates.length,
    "Each date must be unique."
  );
  const start = minutes(body.startTime, "Start time");
  const end = minutes(body.endTime, "End time", true);
  requireValid(end > start, "End time must be after start time.");
  requireValid(
    Number.isInteger(body.duration) &&
      body.duration >= 1 &&
      body.duration <= 1440,
    "Meeting length must be a whole number between 1 and 1440 minutes."
  );
  requireValid(
    body.duration <= end - start,
    "Meeting length must fit within the daily time range."
  );
  const timezone = cleanText(body.timezone, "Time zone", 100);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new ApiError(400, "Choose a valid time zone.");
  }
  return {
    title,
    description,
    dates: [...body.dates].sort(),
    startTime: body.startTime,
    endTime: body.endTime,
    timezone,
    duration: body.duration,
    slotMinutes: 15,
  };
}

function emailInput(value) {
  const email = cleanText(value, "Email", 254, true);
  if (!email) return "";
  const parts = email.split("@");
  const [local = "", domain = ""] = parts;
  const labels = domain.split(".");
  requireValid(
    parts.length === 2 &&
      local.length > 0 &&
      local.length <= 64 &&
      /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) &&
      !local.startsWith(".") &&
      !local.endsWith(".") &&
      !local.includes("..") &&
      labels.length >= 2 &&
      labels.every((label) =>
        /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label)
      ),
    "Enter a valid email address, or leave this field blank."
  );
  return email;
}

function participantInput(body, event, existingParticipant) {
  const name = cleanText(body.name, "Name", 60);
  const email =
    body.email === undefined
      ? existingParticipant?.email || ""
      : emailInput(body.email);
  requireValid(
    Array.isArray(body.slots),
    "Availability must be a list of time slots."
  );
  const start = minutes(event.startTime, "Start time");
  const end = minutes(event.endTime, "End time", true);
  const slotMinutes = event.slotMinutes ?? 30;
  requireValid(
    body.slots.length <=
      event.dates.length * Math.floor((end - start) / slotMinutes),
    "Too many availability slots."
  );
  for (const slot of body.slots) {
    requireValid(
      typeof slot === "string" && /^\d{4}-\d{2}-\d{2}@\d{2}:\d{2}$/.test(slot),
      "Each availability slot must include a date and time."
    );
    const [date, time] = slot.split("@");
    const minute = minutes(time, "Availability time");
    requireValid(
      minute % slotMinutes === 0,
      `Availability must use this event's ${slotMinutes}-minute boundaries.`
    );
    requireValid(
      event.dates.includes(date) &&
        minute >= start &&
        minute + slotMinutes <= end,
      "Availability must be within this event's dates and time range."
    );
  }
  return { name, email, slots: [...new Set(body.slots)].sort() };
}

function normalizedName(name) {
  return name.normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function publicParticipant(participant) {
  return {
    id: participant.id,
    name: participant.name,
    email: participant.email || "",
    slots: participant.slots,
    updatedAt: participant.updatedAt,
  };
}

function publicEvent(event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    dates: event.dates,
    startTime: event.startTime,
    endTime: event.endTime,
    timezone: event.timezone,
    duration: event.duration,
    slotMinutes: event.slotMinutes ?? 30,
    createdAt: event.createdAt,
    participants: event.participants.map(publicParticipant),
  };
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function acceptsEditToken(participant, token) {
  if (!token) return false;
  const actual = Buffer.from(tokenHash(token), "hex");
  const hashes = [
    participant.editTokenHash,
    ...(participant.editTokenHashes || []),
  ];
  return hashes.some((hash) => {
    const expected = Buffer.from(hash, "hex");
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  });
}

// The same application rules run in the local server and Supabase Edge Function.
// Mutations may be retried by the store after a concurrent database update.
export function createScheduleService(store) {
  return async ({ method, pathname, authorization = "", readBody }) => {
    const route =
      /^\/events(?:\/([^/]+)(?:\/participants(?:\/([^/]+)(?:\/(edit-access))?)?)?)?$/.exec(
        pathname
      );
    if (!route) throw new ApiError(404, "API route not found.");
    const [, id, participantId, editAccess] = route;
    if (!id) {
      if (method !== "POST")
        throw new ApiError(405, "Use POST to create a schedule.");
      const input = eventInput(await readBody());
      const event = {
        id: randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
        participants: [],
      };
      await store.create(event);
      return { status: 201, body: publicEvent(event) };
    }
    if (!UUID_PATTERN.test(id))
      throw new ApiError(404, "This schedule could not be found.");
    if (pathname === `/events/${id}`) {
      if (method !== "GET")
        throw new ApiError(405, "Use GET to view a schedule.");
      return { status: 200, body: publicEvent(await store.read(id)) };
    }
    if (participantId && !UUID_PATTERN.test(participantId))
      throw new ApiError(404, "This response could not be found.");
    if (editAccess) {
      if (method !== "POST")
        throw new ApiError(
          405,
          "Use POST to open your response on this device."
        );
      const name = cleanText((await readBody()).name, "Name", 60);
      const body = await store.mutate(id, (event) => {
        const participant = event.participants.find(
          (entry) => entry.id === participantId
        );
        if (!participant)
          throw new ApiError(404, "This response could not be found.");
        // Deliberately preserves the requested honor-system workflow. This is
        // a courtesy check, not proof of identity: event-link holders see names.
        if (normalizedName(name) !== normalizedName(participant.name))
          throw new ApiError(
            403,
            "That name does not match this response. Enter the name shown for your response."
          );
        const hashes = participant.editTokenHashes || [];
        if (hashes.length >= 100)
          throw new ApiError(
            429,
            "This response has reached its device limit. Use a device where you already opened it."
          );
        const editToken = randomBytes(32).toString("hex");
        participant.editTokenHashes = [...hashes, tokenHash(editToken)];
        return { participant: publicParticipant(participant), editToken };
      });
      return { status: 200, body };
    }
    const isCreating = !participantId;
    if (method !== (isCreating ? "POST" : "PUT"))
      throw new ApiError(
        405,
        "Use POST to add availability or PUT to update it."
      );
    const inputBody = await readBody();
    const body = await store.mutate(id, (event) => {
      let participant;
      if (!isCreating) {
        participant = event.participants.find(
          (entry) => entry.id === participantId
        );
        if (!participant)
          throw new ApiError(404, "This response could not be found.");
        const token = authorization.startsWith("Bearer ")
          ? authorization.slice(7)
          : "";
        if (!acceptsEditToken(participant, token))
          throw new ApiError(
            403,
            "This browser does not have permission to edit that response."
          );
      } else if (event.participants.length >= 100) {
        throw new ApiError(
          409,
          "This schedule has reached its limit of 100 people."
        );
      }
      const input = participantInput(inputBody, event, participant);
      if (
        event.participants.some(
          (entry) =>
            entry.id !== participant?.id &&
            normalizedName(entry.name) === normalizedName(input.name)
        )
      )
        throw new ApiError(
          409,
          "That name is already on this schedule. Add a last name or initial to distinguish your response."
        );
      const editToken = isCreating
        ? randomBytes(32).toString("hex")
        : undefined;
      if (isCreating) {
        participant = {
          id: randomUUID(),
          ...input,
          updatedAt: new Date().toISOString(),
          editTokenHash: tokenHash(editToken),
        };
        event.participants.push(participant);
      } else {
        Object.assign(participant, input, {
          updatedAt: new Date().toISOString(),
        });
      }
      return {
        participant: publicParticipant(participant),
        ...(editToken ? { editToken } : {}),
      };
    });
    return { status: isCreating ? 201 : 200, body };
  };
}

export function validateBody(body) {
  requireValid(
    body !== null && typeof body === "object" && !Array.isArray(body),
    "Request data must be an object."
  );
  return body;
}
