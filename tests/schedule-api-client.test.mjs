/* eslint-env node */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/utils/scheduleApi.js", import.meta.url),
  "utf8"
);

async function clientWithUrl(configuredUrl, configuredRegion) {
  const environment =
    configuredUrl === undefined && configuredRegion === undefined
      ? ""
      : `import.meta.env = ${JSON.stringify({
          VITE_SCHEDULE_API_URL: configuredUrl,
          VITE_SCHEDULE_FUNCTION_REGION: configuredRegion,
        })};\n`;
  return import(
    `data:text/javascript;base64,${Buffer.from(environment + source).toString(
      "base64"
    )}`
  );
}

const client = await clientWithUrl();

function recordRequests(t) {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ saved: true }) };
  });
  return requests;
}

test("the client imports without Vite and defaults to the local service", async (t) => {
  for (const value of [undefined, null, "", "   "]) {
    assert.equal(client.resolveScheduleApiRoot(value), "/api/schedule/events");
  }
  const requests = recordRequests(t);
  await client.getEvent("event-a");
  assert.equal(requests[0].url, "/api/schedule/events/event-a");
});

test("complete HTTPS events URLs are normalized without adding another path", () => {
  assert.equal(
    client.resolveScheduleApiRoot(
      " https://PROJECT.supabase.co/functions/v1/schedule-api/events/// "
    ),
    "https://project.supabase.co/functions/v1/schedule-api/events"
  );
});

test("local development permits HTTP only on loopback hosts", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    const url = `http://${host}:54321/functions/v1/schedule-api/events`;
    assert.equal(client.resolveScheduleApiRoot(url), url);
  }
  for (const url of [
    "http://project.supabase.co/functions/v1/schedule-api/events",
    "http://localhost.example.com/events",
    "http://192.168.1.10/events",
    "ftp://localhost/events",
    "//project.supabase.co/events",
    "/different/events",
    "not a URL",
  ]) {
    assert.throws(
      () => client.resolveScheduleApiRoot(url),
      /complete HTTPS events URL/
    );
  }
});

test("API configuration rejects embedded credentials and URL suffixes", () => {
  for (const url of [
    "https://user:password@project.supabase.co/events",
    "https://project.supabase.co/events?apikey=test-key",
    "https://project.supabase.co/events#section",
    "https://project.supabase.co/events?",
    "https://project.supabase.co/events#",
    "https://project.supabase.co/functions/v1/schedule-api/events?forceFunctionRegion=us-east-1",
  ]) {
    assert.throws(
      () => client.resolveScheduleApiRoot(url),
      /must not contain credentials/
    );
  }
});

test("remote requests preserve event paths, bodies, and application Bearer tokens", async (t) => {
  const remote = await clientWithUrl(
    "https://project.supabase.co/functions/v1/schedule-api/events/"
  );
  const requests = recordRequests(t);
  const root = "https://project.supabase.co/functions/v1/schedule-api/events";
  const event = { title: "Team meeting", slotMinutes: 15 };
  const response = {
    name: "Alex",
    email: "alex@example.com",
    slots: ["2026-10-08@09:15"],
  };
  await remote.createEvent(event);
  await remote.getEvent("event /?");
  await remote.saveResponse("event-a", response, null);
  await remote.saveResponse("event-a", response, {
    id: "person/a",
    editToken: "application-edit-token",
  });
  await remote.requestEditAccess("event-a", "person/a", "Alex");

  assert.deepEqual(
    requests.map(({ url }) => url),
    [
      root,
      `${root}/event%20%2F%3F`,
      `${root}/event-a/participants`,
      `${root}/event-a/participants/person%2Fa`,
      `${root}/event-a/participants/person%2Fa/edit-access`,
    ]
  );
  assert.deepEqual(
    requests.map(({ options }) => options.method || "GET"),
    ["POST", "GET", "POST", "PUT", "POST"]
  );
  assert.deepEqual(JSON.parse(requests[0].options.body), event);
  assert.deepEqual(JSON.parse(requests[3].options.body), response);
  assert.deepEqual(requests[3].options.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer application-edit-token",
  });
  assert.deepEqual(requests[4].options.headers, {
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(requests[4].options.body), { name: "Alex" });
  assert.ok(
    requests.every(({ options }) => !Object.hasOwn(options.headers, "apikey"))
  );
});

test("invalid deployment configuration fails through the request without making a fetch", async (t) => {
  const misconfigured = await clientWithUrl("http://remote.example.com/events");
  const requests = recordRequests(t);
  await assert.rejects(
    misconfigured.getEvent("event-a"),
    /complete HTTPS events URL/
  );
  assert.equal(requests.length, 0);
});

test("deleting a response confirms the name and sends its edit token to the configured participant URL", async (t) => {
  const remote = await clientWithUrl(
    "https://project.supabase.co/functions/v1/schedule-api/events/"
  );
  const requests = recordRequests(t);
  for (const current of [client, remote]) {
    assert.deepEqual(
      await current.deleteResponse("event /?", "person/a", "Alex", {
        id: "person/a",
        editToken: "participant-edit-token",
      }),
      { saved: true }
    );
  }
  assert.deepEqual(
    requests.map(({ url }) => url),
    [
      "/api/schedule/events/event%20%2F%3F/participants/person%2Fa",
      "https://project.supabase.co/functions/v1/schedule-api/events/event%20%2F%3F/participants/person%2Fa",
    ]
  );
  for (const { options } of requests) {
    assert.equal(options.method, "DELETE");
    assert.deepEqual(options.headers, {
      "Content-Type": "application/json",
      Authorization: "Bearer participant-edit-token",
    });
    assert.deepEqual(JSON.parse(options.body), {
      name: "Alex",
      confirmed: true,
    });
  }
});

test("delete errors remain actionable to the caller", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: false,
    status: 403,
    json: async () => ({
      error: "Open this person's response before deleting it.",
    }),
  }));
  await assert.rejects(
    client.deleteResponse("event", "person", "Alex", {
      id: "person",
      editToken: "invalid-token",
    }),
    /Open this person's response before deleting it/
  );
});

test("region routing covers every function request without changing bodies or tokens", async (t) => {
  const requests = recordRequests(t);
  const event = { title: "Team meeting", slotMinutes: 15 };
  const response = {
    name: "Alex",
    email: "alex@example.com",
    slots: ["2026-10-08@09:15"],
  };
  const identity = { id: "person/a", editToken: "participant-edit-token" };
  for (const [root, region] of [
    [
      "https://project.supabase.co/functions/v1/schedule-api/events",
      "us-east-1",
    ],
    ["https://api.example.com/functions/v1/schedule-api/events", " us-west-2 "],
  ]) {
    requests.length = 0;
    const remote = await clientWithUrl(root, region);
    await remote.createEvent(event);
    await remote.getEvent("event /?");
    await remote.saveResponse("event-a", response, null);
    await remote.saveResponse("event-a", response, identity);
    await remote.requestEditAccess("event-a", "person/a", "Alex");
    await remote.deleteResponse("event-a", "person/a", "Alex", identity);

    const suffixes = [
      "",
      "/event%20%2F%3F",
      "/event-a/participants",
      "/event-a/participants/person%2Fa",
      "/event-a/participants/person%2Fa/edit-access",
      "/event-a/participants/person%2Fa",
    ];
    assert.deepEqual(
      requests.map(({ url }) => url),
      suffixes.map(
        (suffix) => `${root}${suffix}?forceFunctionRegion=${region.trim()}`
      )
    );
    assert.deepEqual(
      requests.map(({ options }) => options.method || "GET"),
      ["POST", "GET", "POST", "PUT", "POST", "DELETE"]
    );
    assert.deepEqual(
      requests.map(({ options }) =>
        options.body === undefined ? undefined : JSON.parse(options.body)
      ),
      [
        event,
        undefined,
        response,
        response,
        { name: "Alex" },
        { name: "Alex", confirmed: true },
      ]
    );
    for (const [index, { options }] of requests.entries()) {
      assert.deepEqual(options.headers, {
        "Content-Type": "application/json",
        ...([3, 5].includes(index)
          ? { Authorization: "Bearer participant-edit-token" }
          : {}),
      });
    }
  }
});

test("absent or blank function region preserves automatic routing", async (t) => {
  const root = "https://project.supabase.co/functions/v1/schedule-api/events";
  const requests = recordRequests(t);
  for (const region of [undefined, null, "", "   "]) {
    await (await clientWithUrl(root, region)).getEvent("event-a");
  }
  assert.deepEqual(
    requests.map(({ url }) => url),
    Array(4).fill(`${root}/event-a`)
  );
});

test("invalid function regions fail before fetch and do not bypass URL validation", async (t) => {
  const root = "https://project.supabase.co/functions/v1/schedule-api/events";
  const requests = recordRequests(t);
  for (const region of [
    "us-east-9",
    "US-EAST-1",
    "us-east-1&apikey=test-key",
    "any",
    false,
    42,
    {},
  ]) {
    const remote = await clientWithUrl(root, region);
    await assert.rejects(
      remote.getEvent("event-a"),
      /supported Supabase region/
    );
  }
  const unsafeRoot = await clientWithUrl(
    `${root}?apikey=test-key`,
    "us-east-1"
  );
  await assert.rejects(
    unsafeRoot.getEvent("event-a"),
    /must not contain credentials/
  );
  assert.equal(requests.length, 0);
});

test("function region configuration does not change local or remote Node API calls", async (t) => {
  const requests = recordRequests(t);
  const roots = [
    undefined,
    "http://localhost:3000/api/schedule/events",
    "https://api.example.com/api/schedule/events",
  ];
  for (const root of roots) {
    for (const region of ["us-east-1", "invalid-region"]) {
      await (await clientWithUrl(root, region)).getEvent("event-a");
    }
  }
  assert.deepEqual(
    requests.map(({ url }) => url),
    roots.flatMap((root) =>
      Array(2).fill(`${root || "/api/schedule/events"}/event-a`)
    )
  );
});
