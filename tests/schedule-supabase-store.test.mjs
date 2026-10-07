/* eslint-env node */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createSupabaseStore,
  ScheduleStoreError,
} from "../server/supabase-store.mjs";

const projectUrl = "https://schedule-project.supabase.co";
const secretKey = "sb_secret_test_server_credential";
const eventId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const event = (id = eventId) => ({ id, title: "Planning", participants: [] });
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function fakePostgrest() {
  const rows = new Map();
  const calls = [];
  let beforePatch;
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    assert.equal(url.origin, projectUrl);
    assert.equal(url.pathname, "/rest/v1/schedule_events");
    assert.equal(options.redirect, "error");
    const body = options.body && JSON.parse(options.body);
    if (options.method === "POST") {
      if (rows.has(body.id))
        return json({ detail: "Do not expose database internals" }, 409);
      rows.set(body.id, structuredClone(body));
      return new Response(null, { status: 201 });
    }
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    if (options.method === "GET") {
      const row = rows.get(id);
      return json(row ? [structuredClone(row)] : []);
    }
    assert.equal(options.method, "PATCH");
    if (beforePatch) await beforePatch(id, rows);
    const row = rows.get(id);
    const version = Number(
      url.searchParams.get("version")?.replace(/^eq\./, "")
    );
    if (!row || row.version !== version) return json([]);
    rows.set(id, { ...row, ...structuredClone(body) });
    return json([{ id, version: body.version }]);
  };
  return {
    rows,
    calls,
    fetchImpl,
    interceptPatch(callback) {
      beforePatch = callback;
    },
  };
}

function store(database, options = {}) {
  return createSupabaseStore({
    url: projectUrl,
    secretKey,
    fetchImpl: database.fetchImpl,
    ...options,
  });
}

test("private documents persist through independent adapters with scoped requests and server credentials", async () => {
  const database = fakePostgrest();
  const first = store(database);
  const original = event();
  original.participants.push({
    id: "person",
    email: "person@example.org",
    editTokenHash: "private-hash",
    slots: [],
  });
  await first.create(original);
  original.title = "Changed only in caller memory";
  const second = store(database);
  const loaded = await second.read(eventId);
  assert.equal(loaded.title, "Planning");
  assert.equal(loaded.participants[0].editTokenHash, "private-hash");
  loaded.participants.length = 0;
  assert.equal((await first.read(eventId)).participants.length, 1);
  for (const { url, options } of database.calls) {
    assert.equal(url.href.includes(secretKey), false);
    assert.equal(options.headers.apikey, secretKey);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.cache, "no-store");
  }
  await assert.rejects(
    () => first.create(event()),
    (error) => error instanceof ScheduleStoreError && error.status === 409
  );
});

test("simultaneous additions from separate adapters survive compare-and-swap retries", async () => {
  const database = fakePostgrest();
  const first = store(database);
  const second = store(database);
  await first.create(event());
  const mutate = (name) => (document) => {
    document.participants.push({ name });
    return { name, participantCount: document.participants.length };
  };
  const results = await Promise.all([
    first.mutate(eventId, mutate("Katie")),
    second.mutate(eventId, mutate("Alex")),
  ]);
  assert.deepEqual(
    new Set(results.map(({ name }) => name)),
    new Set(["Katie", "Alex"])
  );
  assert.deepEqual(
    (await first.read(eventId)).participants.map(({ name }) => name).sort(),
    ["Alex", "Katie"]
  );
  assert.equal(database.rows.get(eventId).version, 3);
  assert.equal(
    database.calls.filter(({ options }) => options.method === "PATCH").length,
    3
  );
});

test("retry revalidates duplicate names and concurrent edit tokens against the latest document", async () => {
  const database = fakePostgrest();
  const first = store(database);
  const second = store(database);
  await first.create(event());
  const duplicate = Object.assign(new Error("That name already exists."), {
    status: 409,
  });
  const addName = (name) => (document) => {
    if (
      document.participants.some(
        (person) => person.name.toLowerCase() === name.toLowerCase()
      )
    )
      throw duplicate;
    document.participants.push({ name, editTokenHashes: [] });
    return name;
  };
  const names = await Promise.allSettled([
    first.mutate(eventId, addName("Katie")),
    second.mutate(eventId, addName("KATIE")),
  ]);
  assert.equal(names.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(
    names.find(({ status }) => status === "rejected").reason,
    duplicate
  );
  const append = (hash) => (document) => {
    document.participants[0].editTokenHashes.push(hash);
    return hash;
  };
  await Promise.all([
    first.mutate(eventId, append("hash-device-a")),
    second.mutate(eventId, append("hash-device-b")),
  ]);
  assert.deepEqual(
    (await first.read(eventId)).participants[0].editTokenHashes.sort(),
    ["hash-device-a", "hash-device-b"]
  );
});

test("a concurrent name change causes courtesy reclaim validation to rerun before issuing access", async () => {
  const database = fakePostgrest();
  const first = store(database);
  const initial = event();
  initial.participants.push({ name: "Katie", editTokenHashes: [] });
  await first.create(initial);
  let intercepted = false;
  database.interceptPatch((id, rows) => {
    if (intercepted) return;
    intercepted = true;
    const row = rows.get(id);
    row.document.participants[0].name = "Katie C";
    row.version += 1;
  });
  const mismatch = Object.assign(new Error("That name no longer matches."), {
    status: 403,
  });
  await assert.rejects(
    () =>
      first.mutate(eventId, (document) => {
        if (document.participants[0].name !== "Katie") throw mismatch;
        document.participants[0].editTokenHashes.push("must-not-save");
        return "must-not-return";
      }),
    (error) => error === mismatch
  );
  assert.deepEqual(
    (await first.read(eventId)).participants[0].editTokenHashes,
    []
  );
});

test("writes are isolated to their event and conflicts stop after the configured retry limit", async () => {
  const database = fakePostgrest();
  const first = store(database, { maxRetries: 2 });
  await first.create(event());
  await first.create(event(otherId));
  database.interceptPatch((id, rows) => {
    rows.get(id).version += 1;
  });
  let attempts = 0;
  await assert.rejects(
    () =>
      first.mutate(eventId, (document) => {
        attempts += 1;
        document.title = "never committed";
      }),
    (error) => error instanceof ScheduleStoreError && error.status === 409
  );
  assert.equal(attempts, 3);
  assert.equal((await first.read(eventId)).title, "Planning");
  assert.equal(database.rows.get(otherId).version, 1);
  await assert.rejects(
    () => first.read("not-a-uuid"),
    (error) => error.status === 404
  );
  await assert.rejects(
    () => first.read("00000000-0000-4000-8000-000000000003"),
    (error) => error.status === 404
  );
});

test("legacy service-role credentials work while browser keys and insecure server URLs are rejected", async () => {
  const database = fakePostgrest();
  const jwt = (role) =>
    `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
      JSON.stringify({ role })
    ).toString("base64url")}.test-signature`;
  const legacy = jwt("service_role");
  await createSupabaseStore({
    url: projectUrl,
    secretKey: "",
    serviceRoleKey: legacy,
    fetchImpl: database.fetchImpl,
  }).create(event());
  assert.equal(
    database.calls[0].options.headers.Authorization,
    `Bearer ${legacy}`
  );
  for (const key of [
    "sb_publishable_browser_key",
    jwt("anon"),
    "not-a-server-key",
    "",
  ]) {
    assert.throws(
      () =>
        createSupabaseStore({
          url: projectUrl,
          secretKey: key,
          serviceRoleKey: "",
        }),
      (error) =>
        error instanceof ScheduleStoreError &&
        error.status === 503 &&
        !error.message.includes(key || "should-not-appear")
    );
  }
  for (const url of [
    "http://remote.example",
    "https://user:password@example.org",
    "https://example.org/rest/v1",
    "https://example.org?secret=value",
    "https://example.org#fragment",
    "invalid-url",
  ]) {
    assert.throws(
      () => createSupabaseStore({ url, secretKey }),
      (error) => error instanceof ScheduleStoreError && error.status === 503
    );
  }
  assert.doesNotThrow(() =>
    createSupabaseStore({ url: "http://127.0.0.1:54321", secretKey })
  );
});

test("timeouts, transport failures and database errors return safe errors without raw secrets", async () => {
  const sensitive = `${secretKey}: private database diagnostic`;
  for (const fetchImpl of [
    async () => {
      throw new Error(sensitive);
    },
    async () => json({ message: sensitive }, 500),
    async () => new Response(sensitive, { status: 200 }),
    async (_url, options) =>
      new Promise((_resolve, reject) =>
        options.signal.addEventListener(
          "abort",
          () => reject(new Error(sensitive)),
          { once: true }
        )
      ),
  ]) {
    const instance = createSupabaseStore({
      url: projectUrl,
      secretKey,
      fetchImpl,
      timeoutMs: 5,
    });
    await assert.rejects(
      () => instance.read(eventId),
      (error) =>
        error instanceof ScheduleStoreError &&
        error.status === 503 &&
        !error.message.includes(secretKey) &&
        !error.message.includes("diagnostic")
    );
  }
});

test("mutation callbacks must be synchronous and callback failures never write partial changes", async () => {
  const database = fakePostgrest();
  const instance = store(database);
  await instance.create(event());
  const businessError = Object.assign(new Error("Edit token rejected."), {
    status: 403,
  });
  await assert.rejects(
    () =>
      instance.mutate(eventId, (document) => {
        document.title = "partial";
        throw businessError;
      }),
    (error) => error === businessError
  );
  await assert.rejects(
    () =>
      instance.mutate(eventId, async (document) => {
        document.title = "async";
      }),
    (error) => error instanceof ScheduleStoreError && error.status === 500
  );
  assert.equal((await instance.read(eventId)).title, "Planning");
  assert.equal(
    database.calls.some(({ options }) => options.method === "PATCH"),
    false
  );
});

test("shared request limits return exact concurrent allowances and isolate global budgets", async () => {
  const counts = new Map();
  let now = 0;
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.href, `${projectUrl}/rest/v1/rpc/consume_schedule_limit`);
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, secretKey);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, "error");
    const {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    } = JSON.parse(options.body);
    const bucket = `${key}:${Math.floor(now / windowSeconds)}`;
    const count = counts.get(bucket) || 0;
    const allowed = count < limit;
    if (allowed) counts.set(bucket, count + 1);
    return json(allowed);
  };
  const first = createSupabaseStore({ url: projectUrl, secretKey, fetchImpl });
  const second = createSupabaseStore({ url: projectUrl, secretKey, fetchImpl });
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, index) =>
      (index % 2 ? first : second).consumeLimit("schedule:create", 10, 3600)
    )
  );
  assert.equal(results.filter(Boolean).length, 10);
  assert.equal(results.filter((allowed) => !allowed).length, 15);
  assert.equal(await first.consumeLimit("schedule:mutate", 1000, 3600), true);
  assert.equal(await first.consumeLimit("schedule:create", 10, 3600), false);
  now = 3600;
  assert.equal(await second.consumeLimit("schedule:create", 10, 3600), true);
});

test("request-limit validation and backend failures fail closed without leaking details", async () => {
  let calls = 0;
  const instance = createSupabaseStore({
    url: projectUrl,
    secretKey,
    fetchImpl: async () => {
      calls += 1;
      return json(true);
    },
  });
  for (const args of [
    ["", 100, 3600],
    ["bad key", 100, 3600],
    ["x".repeat(121), 100, 3600],
    ["valid", 0, 3600],
    ["valid", 1.5, 3600],
    ["valid", 100001, 3600],
    ["valid", 100, 0],
    ["valid", 100, 1.5],
    ["valid", 100, 86401],
  ]) {
    await assert.rejects(
      () => instance.consumeLimit(...args),
      (error) => error instanceof ScheduleStoreError && error.status === 503
    );
  }
  assert.equal(calls, 0);
  for (const fetchImpl of [
    async () => json({ allowed: true }),
    async () => json(null),
    async () => json({ message: secretKey }, 409),
    async () => json({ message: secretKey }, 500),
    async () => {
      throw new Error(secretKey);
    },
  ]) {
    const failed = createSupabaseStore({
      url: projectUrl,
      secretKey,
      fetchImpl,
    });
    await assert.rejects(
      () => failed.consumeLimit("schedule:create", 100, 3600),
      (error) =>
        error instanceof ScheduleStoreError &&
        error.status === 503 &&
        !error.message.includes(secretKey)
    );
  }
});

test("only the known document-size check produces a safe actionable 413 on create and update", async () => {
  const sizeError = {
    code: "23514",
    message:
      'new row for relation "schedule_events" violates check constraint "schedule_events_document_size"',
    details: `${secretKey}: private row data`,
  };
  for (const operation of ["create", "update"]) {
    const instance = createSupabaseStore({
      url: projectUrl,
      secretKey,
      fetchImpl: async (_input, options) =>
        options.method === "GET"
          ? json([{ id: eventId, version: 1, document: event() }])
          : json(sizeError, 400),
    });
    await assert.rejects(
      () =>
        operation === "create"
          ? instance.create(event())
          : instance.mutate(eventId, (document) => {
              document.title = "Larger";
            }),
      (error) =>
        error instanceof ScheduleStoreError &&
        error.status === 413 &&
        error.message ===
          "This schedule is too large to save. Try selecting fewer dates or times." &&
        !error.message.includes(secretKey)
    );
  }
  for (const failure of [
    { ...sizeError, code: "23502" },
    {
      ...sizeError,
      message: 'violates check constraint "schedule_events_document_object"',
    },
    { ...sizeError, message: null },
  ]) {
    const instance = createSupabaseStore({
      url: projectUrl,
      secretKey,
      fetchImpl: async () => json(failure, 400),
    });
    await assert.rejects(
      () => instance.create(event()),
      (error) =>
        error instanceof ScheduleStoreError &&
        error.status === 503 &&
        !error.message.includes(secretKey)
    );
  }
});
