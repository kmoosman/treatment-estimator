/* eslint-env node */
import assert from "node:assert/strict";
import test from "node:test";
import { createScheduleRateLimit } from "../server/schedule-rate-limit.mjs";
import { ApiError } from "../server/schedule-service.mjs";
import { ScheduleStoreError } from "../server/supabase-store.mjs";

const EVENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MISSING = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function fixture() {
  const calls = [];
  const counts = new Map();
  const events = new Set([EVENT_A, EVENT_B]);
  const store = {
    async read(id) {
      calls.push(["read", id]);
      if (!events.has(id.toLowerCase()))
        throw new ScheduleStoreError(404, "This schedule could not be found.");
      return { id: id.toLowerCase() };
    },
    async consumeLimit(key, limit, seconds) {
      calls.push(["consume", key, limit, seconds]);
      const used = counts.get(key) || 0;
      if (used >= limit) return false;
      counts.set(key, used + 1);
      return true;
    },
  };
  const limit = createScheduleRateLimit(store);
  const run = (method, pathname) =>
    limit({
      request: new Request(`https://example.test/schedule-api${pathname}`, {
        method,
      }),
      pathname,
    });
  return { calls, counts, store, run };
}

test("unrelated routes, invalid identifiers, reads, and unsupported methods do not consume budgets or read storage", async () => {
  const { calls, run } = fixture();
  const paths = [
    ["POST", "/not-a-route"],
    ["POST", "/events/extra"],
    ["GET", "/events"],
    ["PUT", "/events"],
    ["OPTIONS", "/events"],
    ["GET", `/events/${EVENT_A}`],
    ["POST", `/events/${EVENT_A}`],
    ["GET", `/events/${EVENT_A}/participants`],
    ["DELETE", `/events/${EVENT_A}/participants/${PERSON}`],
    ["POST", `/events/${EVENT_A}/participants/${PERSON}`],
    ["PUT", `/events/${EVENT_A}/participants/${PERSON}/edit-access`],
    ["POST", "/events/not-a-uuid/participants"],
    ["PUT", `/events/${EVENT_A}/participants/not-a-uuid`],
    ["POST", `/events/${EVENT_A}/participants/${PERSON}/unknown`],
    ["POST", `/events/${EVENT_A}/participants/${PERSON}/edit-access/extra`],
  ];
  for (const [method, path] of paths) await run(method, path);
  assert.deepEqual(calls, []);
});

test("event creation consumes the separate project storage budget without reading an event", async () => {
  const { calls, counts, run } = fixture();
  await run("POST", "/events");
  assert.deepEqual(calls, [["consume", "schedule:create", 100, 3600]]);
  assert.equal(counts.get("schedule:create"), 1);
});

test("nonexistent events return 404 before arbitrary budget buckets can be created", async () => {
  const { calls, counts, run } = fixture();
  await assert.rejects(
    run("POST", `/events/${MISSING}/participants`),
    (error) => error instanceof ScheduleStoreError && error.status === 404
  );
  assert.deepEqual(calls, [["read", MISSING]]);
  assert.equal(counts.size, 0);
});

test("add, update, and courtesy recovery share one canonical per-event budget while other events stay independent", async () => {
  const { calls, counts, run } = fixture();
  await run("POST", `/events/${EVENT_A.toUpperCase()}/participants`);
  await run("PUT", `/events/${EVENT_A}/participants/${PERSON}`);
  await run("POST", `/events/${EVENT_A}/participants/${PERSON}/edit-access`);
  await run("POST", `/events/${EVENT_B}/participants`);
  assert.deepEqual(
    calls.filter(([operation]) => operation === "consume"),
    [
      ["consume", `schedule:mutate:${EVENT_A}`, 1000, 3600],
      ["consume", `schedule:mutate:${EVENT_A}`, 1000, 3600],
      ["consume", `schedule:mutate:${EVENT_A}`, 1000, 3600],
      ["consume", `schedule:mutate:${EVENT_B}`, 1000, 3600],
    ]
  );
  assert.equal(counts.get(`schedule:mutate:${EVENT_A}`), 3);
  assert.equal(counts.get(`schedule:mutate:${EVENT_B}`), 1);
  for (let index = 0; index < calls.length; index += 2) {
    assert.equal(
      calls[index][0],
      "read",
      "Existence must be checked before budget consumption"
    );
    assert.equal(calls[index + 1][0], "consume");
  }
});

test("exhaustion returns actionable 429 errors and one event cannot exhaust another event's saves", async () => {
  const { counts, run } = fixture();
  counts.set(`schedule:mutate:${EVENT_A}`, 999);
  await run("PUT", `/events/${EVENT_A}/participants/${PERSON}`);
  await assert.rejects(
    run("POST", `/events/${EVENT_A}/participants`),
    (error) =>
      error instanceof ApiError &&
      error.status === 429 &&
      error.message.includes("This schedule")
  );
  await run("POST", `/events/${EVENT_B}/participants`);
  assert.equal(counts.get(`schedule:mutate:${EVENT_A}`), 1000);
  assert.equal(counts.get(`schedule:mutate:${EVENT_B}`), 1);
  counts.set("schedule:create", 100);
  await assert.rejects(
    run("POST", "/events"),
    (error) =>
      error instanceof ApiError &&
      error.status === 429 &&
      error.message.includes("hourly event limit")
  );
  await run("PUT", `/events/${EVENT_B}/participants/${PERSON}`);
  assert.equal(counts.get(`schedule:mutate:${EVENT_B}`), 2);
});

test("storage failures reject writes rather than bypassing limits or replacing a safe service error", async () => {
  const unavailable = new ScheduleStoreError(
    503,
    "Schedule storage is temporarily unavailable."
  );
  let charged = false;
  const missingStorage = createScheduleRateLimit({
    read: async () => {
      throw unavailable;
    },
    consumeLimit: async () => {
      charged = true;
      return true;
    },
  });
  await assert.rejects(
    missingStorage({
      request: new Request("https://example.test", { method: "POST" }),
      pathname: `/events/${EVENT_A}/participants`,
    }),
    (error) => error === unavailable
  );
  assert.equal(charged, false);
  const failedBudget = createScheduleRateLimit({
    read: async () => ({ id: EVENT_A }),
    consumeLimit: async () => {
      throw unavailable;
    },
  });
  await assert.rejects(
    failedBudget({
      request: new Request("https://example.test", { method: "PUT" }),
      pathname: `/events/${EVENT_A}/participants/${PERSON}`,
    }),
    (error) => error === unavailable
  );
});
