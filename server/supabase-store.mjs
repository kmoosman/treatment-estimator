/* eslint-env node */
const uuidPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const unavailableMessage =
  "Schedule storage is temporarily unavailable. Please try again.";

export class ScheduleStoreError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ScheduleStoreError";
    this.status = status;
  }
}

function storageUnavailable() {
  return new ScheduleStoreError(503, unavailableMessage);
}

function validateId(id) {
  if (typeof id !== "string" || !uuidPattern.test(id)) {
    throw new ScheduleStoreError(404, "This schedule could not be found.");
  }
  return id.toLowerCase();
}

function serverUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ScheduleStoreError(503, "Schedule storage is not configured.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new ScheduleStoreError(
      503,
      "Schedule storage needs a valid secure server URL."
    );
  }
  return `${url.origin}/rest/v1`;
}

function legacyServiceRole(key) {
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function serverHeaders(key) {
  if (typeof key !== "string" || !key || /\s/.test(key)) {
    throw new ScheduleStoreError(
      503,
      "Schedule storage needs a server secret key."
    );
  }
  if (key.startsWith("sb_secret_")) {
    return { apikey: key, "Content-Type": "application/json" };
  }
  if (legacyServiceRole(key)) {
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  }
  throw new ScheduleStoreError(
    503,
    "Schedule storage needs a server secret key."
  );
}

/**
 * Server-only PostgREST storage. Never import this module into the browser app.
 * mutate callbacks must be synchronous and safe to rerun after a concurrent edit.
 */
export function createSupabaseStore({
  url = globalThis.process?.env?.SUPABASE_URL,
  secretKey = globalThis.process?.env?.SUPABASE_SECRET_KEY,
  serviceRoleKey = globalThis.process?.env?.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000,
  maxRetries = 5,
} = {}) {
  const endpoint = serverUrl(url);
  const credentials = serverHeaders(secretKey || serviceRoleKey);
  if (
    typeof fetchImpl !== "function" ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    !Number.isInteger(maxRetries) ||
    maxRetries < 0 ||
    maxRetries > 20
  )
    throw new ScheduleStoreError(503, "Schedule storage is not configured.");

  async function request(
    method,
    query = {},
    body,
    returnJson = true,
    resource = "schedule_events"
  ) {
    const target = new URL(`${endpoint}/${resource}`);
    for (const [name, value] of Object.entries(query))
      target.searchParams.set(name, value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(target.href, {
        method,
        headers: {
          ...credentials,
          Accept: "application/json",
          Prefer: returnJson ? "return=representation" : "return=minimal",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) {
        if (
          response.status === 400 &&
          resource === "schedule_events" &&
          ["POST", "PATCH"].includes(method)
        ) {
          const failure = await response.json().catch(() => null);
          if (
            failure?.code === "23514" &&
            typeof failure.message === "string" &&
            failure.message.includes('"schedule_events_document_size"')
          ) {
            throw new ScheduleStoreError(
              413,
              "This schedule is too large to save. Try selecting fewer dates or times."
            );
          }
        }
        if (
          response.status === 409 &&
          method === "POST" &&
          resource === "schedule_events"
        ) {
          throw new ScheduleStoreError(
            409,
            "A schedule with that identifier already exists."
          );
        }
        throw storageUnavailable();
      }
      return returnJson ? await response.json() : undefined;
    } catch (error) {
      if (error instanceof ScheduleStoreError) throw error;
      // Do not forward transport errors, database messages, headers, or secrets.
      throw storageUnavailable();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function readRecord(id) {
    const rows = await request("GET", {
      id: `eq.${id}`,
      select: "id,document,version",
      limit: "1",
    });
    if (!Array.isArray(rows)) throw storageUnavailable();
    if (rows.length === 0)
      throw new ScheduleStoreError(404, "This schedule could not be found.");
    const row = rows[0];
    if (
      rows.length !== 1 ||
      row.id !== id ||
      !Number.isInteger(row.version) ||
      row.version < 1 ||
      !row.document ||
      typeof row.document !== "object" ||
      Array.isArray(row.document) ||
      row.document.id !== id
    )
      throw storageUnavailable();
    return { version: row.version, document: structuredClone(row.document) };
  }

  return {
    async consumeLimit(key, limit, windowSeconds) {
      if (
        typeof key !== "string" ||
        !/^[A-Za-z0-9:_-]{1,120}$/.test(key) ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100000 ||
        !Number.isInteger(windowSeconds) ||
        windowSeconds < 1 ||
        windowSeconds > 86400
      )
        throw new ScheduleStoreError(
          503,
          "Request limiting is not configured."
        );
      const allowed = await request(
        "POST",
        {},
        {
          p_key: key,
          p_limit: limit,
          p_window_seconds: windowSeconds,
        },
        true,
        "rpc/consume_schedule_limit"
      );
      if (typeof allowed !== "boolean") throw storageUnavailable();
      return allowed;
    },

    async create(event) {
      const id = validateId(event?.id);
      if (event.id !== id)
        throw new ScheduleStoreError(
          400,
          "Schedule identifiers must use their canonical format."
        );
      await request(
        "POST",
        {},
        { id, document: structuredClone(event), version: 1 },
        false
      );
      return structuredClone(event);
    },

    async read(eventId) {
      return (await readRecord(validateId(eventId))).document;
    },

    async mutate(eventId, callback) {
      const id = validateId(eventId);
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const { document, version } = await readRecord(id);
        // Revalidate courtesy name matches, tokens, and duplicate names on every retry.
        const result = callback(document);
        if (result && typeof result.then === "function") {
          Promise.resolve(result).catch(() => {});
          throw new ScheduleStoreError(
            500,
            "Schedule updates must run synchronously."
          );
        }
        if (document.id !== id || version >= 2147483647)
          throw storageUnavailable();
        const updated = await request(
          "PATCH",
          {
            id: `eq.${id}`,
            version: `eq.${version}`,
            select: "id,version",
          },
          {
            document,
            version: version + 1,
            updated_at: new Date().toISOString(),
          }
        );
        if (!Array.isArray(updated) || updated.length > 1)
          throw storageUnavailable();
        if (updated.length === 1) {
          if (updated[0].id !== id || updated[0].version !== version + 1)
            throw storageUnavailable();
          return result;
        }
      }
      throw new ScheduleStoreError(
        409,
        "This schedule changed while saving. Please try again."
      );
    },
  };
}
