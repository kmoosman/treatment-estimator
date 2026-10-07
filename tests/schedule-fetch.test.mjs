/* eslint-env node */
import assert from "node:assert/strict";
import test from "node:test";
import { createScheduleFetchHandler } from "../server/schedule-fetch.mjs";
import {
  ApiError,
  BODY_LIMIT,
  UUID_PATTERN,
} from "../server/schedule-service.mjs";
import { ScheduleStoreError } from "../server/supabase-store.mjs";

const ORIGIN = "https://oncologic.example";
const EDGE_ORIGIN = "https://project.supabase.co";
const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const eventInput = {
  title: "Team planning",
  description: "Find a time for our discussion.",
  dates: ["2026-10-07", "2026-10-08"],
  startTime: "09:00",
  endTime: "17:00",
  timezone: "America/New_York",
  duration: 20,
};

function memoryStore(documents = new Map()) {
  const calls = [];
  return {
    calls,
    documents,
    async create(event) {
      calls.push(["create", event.id]);
      documents.set(event.id, structuredClone(event));
    },
    async read(id) {
      calls.push(["read", id]);
      if (!documents.has(id))
        throw new ApiError(404, "This schedule could not be found.");
      return structuredClone(documents.get(id));
    },
    async mutate(id, callback) {
      calls.push(["mutate", id]);
      if (!documents.has(id))
        throw new ApiError(404, "This schedule could not be found.");
      const draft = structuredClone(documents.get(id));
      const result = callback(draft);
      assert.ok(
        !(result instanceof Promise),
        "Store mutation callbacks must stay synchronous"
      );
      documents.set(id, structuredClone(draft));
      return structuredClone(result);
    },
  };
}

function client(handler, prefix = "/schedule-api", origin = ORIGIN) {
  return async (
    path,
    { method = "GET", body, rawBody, headers = {}, token } = {}
  ) => {
    const requestHeaders = { ...headers };
    if (origin !== null) requestHeaders.Origin = origin;
    if (body !== undefined || rawBody !== undefined)
      requestHeaders["Content-Type"] ??= "application/json";
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
    const response = await handler(
      new Request(`${EDGE_ORIGIN}${prefix}${path}`, {
        method,
        headers: requestHeaders,
        body:
          rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
      })
    );
    const text = await response.text();
    return {
      response,
      status: response.status,
      headers: response.headers,
      body: text ? JSON.parse(text) : null,
    };
  };
}

function assertCors(response) {
  assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN);
  assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
  assert.match(response.headers.get("vary"), /(?:^|,\s*)Origin(?:,|$)/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-type"), /^application\/json/);
}

test("Fetch routing supports full Edge and short prefixes, preserving shared emails and courtesy editing", async () => {
  const documents = new Map();
  const firstStore = memoryStore(documents);
  const secondStore = memoryStore(documents);
  const first = client(
    createScheduleFetchHandler({ store: firstStore, allowedOrigins: [ORIGIN] }),
    "/functions/v1/schedule-api"
  );
  const second = client(
    createScheduleFetchHandler({ store: secondStore, allowedOrigins: [ORIGIN] })
  );
  const created = await first("/events", { method: "POST", body: eventInput });
  assert.equal(created.status, 201);
  assert.match(created.body.id, UUID_PATTERN);
  assert.equal(created.body.slotMinutes, 15);
  assert.equal(created.body.duration, 20);
  assertCors(created);
  const path = `/events/${created.body.id}`;
  const added = await first(`${path}/participants`, {
    method: "POST",
    body: {
      name: "Alex Morgan",
      email: "alex@example.com",
      slots: ["2026-10-07@09:00", "2026-10-07@09:15"],
    },
  });
  assert.equal(added.status, 201);
  assert.match(added.body.editToken, /^[a-f0-9]{64}$/);
  assert.equal(added.body.participant.editTokenHash, undefined);
  const participantPath = `${path}/participants/${added.body.participant.id}`;
  const shared = await second(path);
  assert.equal(shared.status, 200);
  assert.equal(shared.body.participants[0].email, "alex@example.com");
  assertCors(shared);
  const denied = await second(participantPath, {
    method: "PUT",
    token: "not-a-participant-token",
    body: { name: "Alex Morgan", slots: [] },
  });
  assert.equal(denied.status, 403);
  assertCors(denied);
  const mismatch = await second(`${participantPath}/edit-access`, {
    method: "POST",
    body: { name: "Someone else" },
  });
  assert.equal(mismatch.status, 403);
  const access = await second(`${participantPath}/edit-access`, {
    method: "POST",
    body: { name: "  ALEX   MORGAN  " },
  });
  assert.equal(access.status, 200);
  assert.equal(access.body.participant.email, "alex@example.com");
  assert.notEqual(access.body.editToken, added.body.editToken);
  const edited = await second(participantPath, {
    method: "PUT",
    token: access.body.editToken,
    body: { name: "Alex M", slots: ["2026-10-08@10:15"] },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.participant.email, "alex@example.com");
  assert.equal(edited.body.editToken, undefined);
  const originalStillWorks = await first(participantPath, {
    method: "PUT",
    token: added.body.editToken,
    body: { name: "Alex M", email: "", slots: [] },
  });
  assert.equal(originalStillWorks.status, 200);
  const staleName = await first(`${participantPath}/edit-access`, {
    method: "POST",
    body: { name: "Alex Morgan" },
  });
  assert.equal(staleName.status, 403);
  const final = await second(path);
  assert.deepEqual(final.body.participants, [
    originalStillWorks.body.participant,
  ]);
  assert.equal(
    shared.body.participants[0].name,
    "Alex Morgan",
    "Earlier responses must not mutate"
  );
  const publicJson = JSON.stringify(final.body);
  const persisted = documents.get(created.body.id).participants[0];
  for (const secret of [
    "editToken",
    added.body.editToken,
    access.body.editToken,
    persisted.editTokenHash,
    ...persisted.editTokenHashes,
  ]) {
    assert.ok(
      !publicJson.includes(secret),
      "Public event responses must omit edit secrets"
    );
  }
  assert.ok(firstStore.calls.length > 0 && secondStore.calls.length > 0);
});

test("OPTIONS handles browser preflight without a body, storage access, or rate-limit work", async () => {
  const store = memoryStore();
  let rateCalls = 0;
  const handler = createScheduleFetchHandler({
    store,
    allowedOrigins: [ORIGIN],
    rateLimit: () => {
      rateCalls += 1;
    },
  });
  const response = await handler(
    new Request(
      `${EDGE_ORIGIN}/functions/v1/schedule-api/events/${EVENT_ID}/participants`,
      {
        method: "OPTIONS",
        headers: {
          Origin: ORIGIN,
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "authorization, content-type",
        },
      }
    )
  );
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assertCors(response);
  assert.match(
    response.headers.get("access-control-allow-headers"),
    /authorization/i
  );
  assert.match(
    response.headers.get("access-control-allow-headers"),
    /content-type/i
  );
  assert.match(response.headers.get("access-control-allow-methods"), /PUT/);
  assert.deepEqual(store.calls, []);
  assert.equal(rateCalls, 0);
});

test("CORS permits exact configured origins, rejects other browser origins, and never enables a wildcard", async () => {
  const store = memoryStore();
  const handler = createScheduleFetchHandler({
    store,
    allowedOrigins: [ORIGIN],
  });
  for (const origin of [
    "https://unrelated.example",
    `${ORIGIN}.attacker.example`,
    "null",
  ]) {
    const response = await client(
      handler,
      "/schedule-api",
      origin
    )("/events", { method: "POST", body: eventInput });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(typeof response.body.error, "string");
  }
  assert.deepEqual(store.calls, []);
  for (const allowedOrigins of [[], ["*"]]) {
    const response = await client(
      createScheduleFetchHandler({ store, allowedOrigins })
    )("/events", { method: "POST", body: eventInput });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  const noOrigin = await client(
    handler,
    "/schedule-api",
    null
  )("/events", { method: "POST", body: eventInput });
  assert.equal(
    noOrigin.status,
    201,
    "Server callers without Origin may use the public shared-link API"
  );
  assert.equal(noOrigin.headers.get("access-control-allow-origin"), null);
});

test("streamed body limits count actual bytes and cancel oversized streams despite missing or dishonest Content-Length", async () => {
  for (const claimedLength of [undefined, "1"]) {
    const store = memoryStore();
    const handler = createScheduleFetchHandler({
      store,
      allowedOrigins: [ORIGIN],
    });
    let canceled = false;
    let pulls = 0;
    const stream = new ReadableStream({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(16 * 1024).fill(97));
      },
      cancel() {
        canceled = true;
      },
    });
    const headers = { Origin: ORIGIN, "Content-Type": "application/json" };
    if (claimedLength !== undefined) headers["Content-Length"] = claimedLength;
    const response = await handler(
      new Request(`${EDGE_ORIGIN}/schedule-api/events`, {
        method: "POST",
        headers,
        body: stream,
        duplex: "half",
      })
    );
    assert.equal(response.status, 413);
    assertCors(response);
    assert.equal(canceled, true);
    assert.ok(pulls < 20, "The handler must stop consuming an oversized body");
    assert.deepEqual(store.calls, []);
  }
  const handler = createScheduleFetchHandler({
    store: memoryStore(),
    allowedOrigins: [ORIGIN],
  });
  const multiByte = JSON.stringify({
    ...eventInput,
    padding: "😀".repeat(BODY_LIMIT / 4),
  });
  assert.ok(multiByte.length < BODY_LIMIT);
  const response = await client(handler)("/events", {
    method: "POST",
    rawBody: multiByte,
  });
  assert.equal(
    response.status,
    413,
    "UTF-8 byte size, not JavaScript string length, determines the body limit"
  );
  assertCors(response);
});

test("JSON/body validation and unsupported routes return actionable errors with CORS", async () => {
  const store = memoryStore();
  const handler = createScheduleFetchHandler({
    store,
    allowedOrigins: [ORIGIN],
  });
  const request = client(handler);
  const cases = [
    ["/events", { method: "POST", rawBody: "{broken" }, 400],
    ["/events", { method: "POST", rawBody: "null" }, 400],
    ["/events", { method: "POST", rawBody: "[]" }, 400],
    [
      "/events",
      {
        method: "POST",
        body: eventInput,
        headers: { "Content-Type": "text/plain" },
      },
      415,
    ],
    [
      "/events",
      {
        method: "POST",
        body: eventInput,
        headers: { "Content-Length": String(BODY_LIMIT + 1) },
      },
      413,
    ],
    ["/events", {}, 405],
    ["/events", { method: "DELETE" }, 405],
    ["/events/not-a-uuid", {}, 404],
    [`/events/${EVENT_ID}`, {}, 404],
    [
      `/events/${EVENT_ID}/participants/not-a-uuid`,
      { method: "PUT", body: {} },
      404,
    ],
    [`/events/${EVENT_ID}/unknown`, {}, 404],
    ["/events/trailing/segments/not/a/route", {}, 404],
  ];
  for (const [path, options, expected] of cases) {
    const response = await request(path, options);
    assert.equal(
      response.status,
      expected,
      `${options.method || "GET"} ${path}`
    );
    assert.equal(typeof response.body.error, "string");
    assertCors(response);
  }
  for (const path of [
    "/unrelated/events",
    "/schedule-api",
    "/schedule-api-ish/events",
  ]) {
    const response = await handler(
      new Request(`${EDGE_ORIGIN}${path}`, { headers: { Origin: ORIGIN } })
    );
    assert.equal(response.status, 404, path);
    assertCors(response);
  }
});

test("custom base paths and case-insensitive Fetch headers reach the same service", async () => {
  const handler = createScheduleFetchHandler({
    store: memoryStore(),
    basePath: "/meeting-cloud",
    allowedOrigins: [ORIGIN],
  });
  const response = await handler(
    new Request(`${EDGE_ORIGIN}/functions/v1/meeting-cloud/events`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-TYPE": "Application/JSON; charset=UTF-8",
      },
      body: JSON.stringify({ ...eventInput, title: "Planning café" }),
    })
  );
  assert.equal(response.status, 201);
  assert.equal((await response.json()).title, "Planning café");
  assertCors(response);
});

test("rate and storage failures preserve safe statuses and CORS without leaking unexpected exceptions", async () => {
  const store = memoryStore();
  const ratePaths = [];
  const limited = createScheduleFetchHandler({
    store,
    allowedOrigins: [ORIGIN],
    rateLimit: ({ pathname }) => {
      ratePaths.push(pathname);
      throw new ApiError(429, "Too many requests. Please try again shortly.");
    },
  });
  const denied = await client(limited)("/events", {
    method: "POST",
    body: eventInput,
  });
  assert.equal(denied.status, 429);
  assertCors(denied);
  assert.deepEqual(ratePaths, ["/events"]);
  assert.deepEqual(store.calls, []);
  for (const failure of [
    new ScheduleStoreError(503, "Schedule storage is temporarily unavailable."),
    new Error("Private database credentials: secret-test-value"),
  ]) {
    const failingStore = {
      ...memoryStore(),
      read: () => {
        throw failure;
      },
    };
    const response = await client(
      createScheduleFetchHandler({
        store: failingStore,
        allowedOrigins: [ORIGIN],
      })
    )(`/events/${EVENT_ID}`);
    assert.equal(
      response.status,
      failure instanceof ScheduleStoreError ? 503 : 500
    );
    assertCors(response);
    assert.ok(!JSON.stringify(response.body).includes("secret-test-value"));
    assert.ok(!JSON.stringify(response.body).includes("Private database"));
  }
});
