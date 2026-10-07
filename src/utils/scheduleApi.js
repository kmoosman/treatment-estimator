const LOCAL_API_ROOT = "/api/schedule/events";
const CONFIGURED_API_URL = import.meta.env?.VITE_SCHEDULE_API_URL;

export function resolveScheduleApiRoot(configuredUrl) {
  if (configuredUrl == null || configuredUrl === "") return LOCAL_API_ROOT;
  const invalidUrl =
    "VITE_SCHEDULE_API_URL must be a complete HTTPS events URL. HTTP is allowed only for localhost.";
  if (typeof configuredUrl !== "string") throw new Error(invalidUrl);
  const value = configuredUrl.trim();
  if (!value) return LOCAL_API_ROOT;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(invalidUrl);
  }
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost))
    throw new Error(invalidUrl);
  if (url.username || url.password || /[?#]/.test(url.href)) {
    throw new Error(
      "VITE_SCHEDULE_API_URL must not contain credentials, query parameters, or a fragment."
    );
  }
  return url.href.replace(/\/+$/, "");
}

async function request(path = "", options = {}) {
  const apiRoot = resolveScheduleApiRoot(CONFIGURED_API_URL);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  let data;
  try {
    response = await fetch(`${apiRoot}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    data = await response.json().catch(() => null);
  } catch {
    if (controller.signal.aborted)
      throw new Error(
        "The scheduling service took too long to respond. Please try again."
      );
    throw new Error(
      "We couldn’t reach the scheduling service. Please try again."
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok || !data) {
    throw new Error(
      data?.error || "The scheduling service is unavailable. Please try again."
    );
  }
  return data;
}

export const createEvent = (event) =>
  request("", { method: "POST", body: JSON.stringify(event) });
export const getEvent = (id) => request(`/${encodeURIComponent(id)}`);
export const requestEditAccess = (eventId, participantId, name) =>
  request(
    `/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(
      participantId
    )}/edit-access`,
    { method: "POST", body: JSON.stringify({ name }) }
  );
export const saveResponse = (eventId, response, identity) =>
  request(
    `/${encodeURIComponent(eventId)}/participants${
      identity ? `/${encodeURIComponent(identity.id)}` : ""
    }`,
    {
      method: identity ? "PUT" : "POST",
      headers: identity
        ? { Authorization: `Bearer ${identity.editToken}` }
        : {},
      body: JSON.stringify(response),
    }
  );

const RECENTS_KEY = "schedule:recent";
export function readStored(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export const identityKey = (id) => `schedule:identity:${id}`;
const identitiesKey = (id) => `schedule:identities:${id}`;

function validIdentity(value) {
  if (
    !value ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.editToken !== "string" ||
    !value.editToken.trim()
  )
    return null;
  return { id: value.id.trim(), editToken: value.editToken.trim() };
}

function loadIdentities(eventId) {
  const records = readStored(identitiesKey(eventId), []);
  const byId = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const identity = validIdentity(record);
    if (identity) byId.set(identity.id, identity);
  }
  const active = validIdentity(readStored(identityKey(eventId)));
  const needsMigration =
    active && byId.get(active.id)?.editToken !== active.editToken;
  if (active) byId.set(active.id, active);
  const identities = [...byId.values()];
  // Preserve a legacy active token before allowing the active selection to change.
  const persisted =
    !needsMigration || writeStored(identitiesKey(eventId), identities);
  return { identities, persisted };
}

export function rememberedIdentities(eventId) {
  return loadIdentities(eventId).identities;
}

export function rememberIdentity(eventId, identity) {
  const next = validIdentity(identity);
  if (!next) return false;
  const identities = loadIdentities(eventId).identities;
  const byId = new Map(identities.map((item) => [item.id, item]));
  byId.set(next.id, next);
  if (!writeStored(identitiesKey(eventId), [...byId.values()])) return false;
  return writeStored(identityKey(eventId), next);
}

export function selectIdentity(eventId, identityOrNull) {
  const next = identityOrNull === null ? null : validIdentity(identityOrNull);
  if (identityOrNull !== null && !next) return false;
  if (!loadIdentities(eventId).persisted) return false;
  return writeStored(identityKey(eventId), next);
}

export function recentEvents() {
  const records = readStored(RECENTS_KEY, []);
  return Array.isArray(records)
    ? records.filter((event) => event?.id && event?.title).slice(0, 6)
    : [];
}
export function removeRecentEvent(id) {
  return writeStored(
    RECENTS_KEY,
    recentEvents().filter((event) => event.id !== id)
  );
}
export function clearRecentEvents() {
  return writeStored(RECENTS_KEY, []);
}
export function rememberEvent(event) {
  writeStored(
    RECENTS_KEY,
    [
      { id: event.id, title: event.title, dates: event.dates },
      ...recentEvents().filter((item) => item.id !== event.id),
    ].slice(0, 6)
  );
}
