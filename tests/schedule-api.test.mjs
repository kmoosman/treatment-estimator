/* eslint-env node */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createScheduleMiddleware } from "../server/schedule-api.mjs";

const eventInput = {
  title: "Team planning",
  description: "Find a time for our discussion.",
  dates: ["2026-10-07", "2026-10-08"],
  startTime: "09:00",
  endTime: "17:00",
  timezone: "America/New_York",
  duration: 60,
};

async function startServer(t, directory) {
  const middleware = createScheduleMiddleware({ dataDir: directory });
  const server = createServer((request, response) =>
    middleware(request, response, () => {
      response.writeHead(404);
      response.end("Not found.");
    })
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  return async function request(
    path,
    {
      method = "GET",
      body,
      rawBody,
      contentType = "application/json",
      token,
    } = {}
  ) {
    const headers = { "Content-Type": contentType };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${base}/api/schedule${path}`, {
      method,
      headers,
      body:
        rawBody === undefined
          ? body === undefined
            ? undefined
            : JSON.stringify(body)
          : rawBody,
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    };
  };
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "schedule-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, request: await startServer(t, directory) };
}

async function createEvent(request, overrides = {}) {
  const response = await request("/events", {
    method: "POST",
    body: { ...eventInput, ...overrides },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

test("a shared event and availability survive a fresh API instance without exposing edit secrets", async (t) => {
  const { directory, request } = await fixture(t);
  const event = await createEvent(request, {
    title: "  Team planning  ",
    dates: [...eventInput.dates].reverse(),
  });
  assert.equal(event.title, "Team planning");
  assert.deepEqual(event.dates, eventInput.dates);
  assert.deepEqual(event.participants, []);

  const added = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: {
      name: "  Katie  ",
      slots: ["2026-10-07@10:00", "2026-10-07@09:30"],
    },
  });
  assert.equal(added.status, 201);
  assert.equal(added.body.participant.name, "Katie");
  assert.match(added.body.editToken, /^[a-f0-9]{64}$/);
  assert.equal(added.body.participant.editTokenHash, undefined);

  const anotherBrowser = await startServer(t, directory);
  const shared = await anotherBrowser(`/events/${event.id}`);
  assert.equal(shared.status, 200);
  assert.equal(shared.headers.get("cache-control"), "no-store");
  assert.deepEqual(shared.body.participants, [added.body.participant]);
  assert.equal(JSON.stringify(shared.body).includes("editToken"), false);
  assert.equal(
    JSON.stringify(shared.body).includes(added.body.editToken),
    false
  );
  const saved = JSON.parse(
    await readFile(join(directory, `${event.id}.json`), "utf8")
  );
  assert.notEqual(saved.participants[0].editTokenHash, added.body.editToken);
  assert.deepEqual(await readdir(directory), [`${event.id}.json`]);
});

test("only a participant's edit token can update their response, including clearing availability", async (t) => {
  const { request } = await fixture(t);
  const event = await createEvent(request);
  const added = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: { name: "Katie", slots: ["2026-10-07@09:00"] },
  });
  const second = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: { name: "Alex", slots: [] },
  });
  const path = `/events/${event.id}/participants/${added.body.participant.id}`;
  for (const token of [undefined, "not-an-edit-token", second.body.editToken]) {
    const denied = await request(path, {
      method: "PUT",
      body: { name: "Changed", slots: [] },
      token,
    });
    assert.equal(denied.status, 403);
  }
  const updated = await request(path, {
    method: "PUT",
    body: { name: "Katie C", slots: [] },
    token: added.body.editToken,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.participant.name, "Katie C");
  assert.deepEqual(updated.body.participant.slots, []);
  assert.equal(updated.body.editToken, undefined);
  const shared = await request(`/events/${event.id}`);
  assert.equal(shared.body.participants[0].name, "Katie C");
  assert.equal(shared.body.participants[1].name, "Alex");
});

test("a courtesy name match opens editing on another device without invalidating existing devices", async (t) => {
  const { request, directory } = await fixture(t);
  const event = await createEvent(request);
  const original = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: { name: "Katie Coleman", slots: ["2026-10-07@09:00"] },
  });
  const path = `/events/${event.id}/participants/${original.body.participant.id}`;
  const anotherDevice = await startServer(t, directory);
  const mismatch = await anotherDevice(`${path}/edit-access`, {
    method: "POST",
    body: { name: "Alex" },
  });
  assert.equal(mismatch.status, 403);
  assert.equal(mismatch.body.editToken, undefined);
  const opened = await anotherDevice(`${path}/edit-access`, {
    method: "POST",
    body: { name: "  KATIE   COLEMAN  " },
  });
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.body.participant, original.body.participant);
  assert.match(opened.body.editToken, /^[a-f0-9]{64}$/);
  assert.notEqual(opened.body.editToken, original.body.editToken);

  const secondEdit = await anotherDevice(path, {
    method: "PUT",
    token: opened.body.editToken,
    body: { name: "Katie Coleman", slots: ["2026-10-08@14:00"] },
  });
  assert.equal(secondEdit.status, 200);
  const originalEdit = await request(path, {
    method: "PUT",
    token: original.body.editToken,
    body: { name: "Katie C", slots: ["2026-10-08@14:30"] },
  });
  assert.equal(originalEdit.status, 200);
  const previousName = await anotherDevice(`${path}/edit-access`, {
    method: "POST",
    body: { name: "Katie Coleman" },
  });
  assert.equal(previousName.status, 403);
  const third = await anotherDevice(`${path}/edit-access`, {
    method: "POST",
    body: { name: "Katie C" },
  });
  assert.equal(third.status, 200);

  const freshInstance = await startServer(t, directory);
  for (const token of [
    original.body.editToken,
    opened.body.editToken,
    third.body.editToken,
  ]) {
    const saved = await freshInstance(path, {
      method: "PUT",
      token,
      body: { name: "Katie C", slots: [] },
    });
    assert.equal(saved.status, 200);
  }
  const shared = await freshInstance(`/events/${event.id}`);
  assert.equal(JSON.stringify(shared.body).includes("editToken"), false);
  for (const token of [
    original.body.editToken,
    opened.body.editToken,
    third.body.editToken,
  ]) {
    assert.equal(JSON.stringify(shared.body).includes(token), false);
  }
  const persisted = JSON.parse(
    await readFile(join(directory, `${event.id}.json`), "utf8")
  );
  assert.equal(persisted.participants[0].editTokenHashes.length, 2);
  assert.equal(
    persisted.participants[0].editTokenHashes.includes(opened.body.editToken),
    false
  );
});

test("edit-access rejects missing names and unknown responses without altering availability", async (t) => {
  const { request } = await fixture(t);
  const event = await createEvent(request);
  const original = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: { name: "Katie", slots: [] },
  });
  const path = `/events/${event.id}/participants/${original.body.participant.id}/edit-access`;
  for (const name of [undefined, "", " ", "x".repeat(61)]) {
    assert.equal(
      (await request(path, { method: "POST", body: { name } })).status,
      400
    );
  }
  assert.equal((await request(path)).status, 405);
  assert.equal(
    (
      await request(`/events/${event.id}/participants/unknown/edit-access`, {
        method: "POST",
        body: { name: "Katie" },
      })
    ).status,
    404
  );
  const unchanged = await request(`/events/${event.id}`);
  assert.deepEqual(unchanged.body.participants, [original.body.participant]);
});

test("optional participant emails are shared, returned across devices, and preserved or cleared by edits", async (t) => {
  const { request, directory } = await fixture(t);
  const event = await createEvent(request);
  const original = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: { name: "Katie", email: "  katie+planning@example.org  ", slots: [] },
  });
  assert.equal(original.status, 201);
  assert.equal(original.body.participant.email, "katie+planning@example.org");
  const path = `/events/${event.id}/participants/${original.body.participant.id}`;
  const anotherDevice = await startServer(t, directory);
  const shared = await anotherDevice(`/events/${event.id}`);
  assert.equal(shared.body.participants[0].email, "katie+planning@example.org");
  const access = await anotherDevice(`${path}/edit-access`, {
    method: "POST",
    body: { name: "Katie" },
  });
  assert.equal(access.body.participant.email, "katie+planning@example.org");
  const preserved = await anotherDevice(path, {
    method: "PUT",
    token: access.body.editToken,
    body: { name: "Katie", slots: ["2026-10-07@09:00"] },
  });
  assert.equal(preserved.body.participant.email, "katie+planning@example.org");
  const replaced = await request(path, {
    method: "PUT",
    token: original.body.editToken,
    body: { name: "Katie", email: "Katie.Coleman@example.co.uk", slots: [] },
  });
  assert.equal(replaced.body.participant.email, "Katie.Coleman@example.co.uk");
  const invalidEdit = await request(path, {
    method: "PUT",
    token: original.body.editToken,
    body: { name: "Katie", email: "not an email", slots: [] },
  });
  assert.equal(invalidEdit.status, 400);
  const afterRejectedEdit = await anotherDevice(`/events/${event.id}`);
  assert.equal(
    afterRejectedEdit.body.participants[0].email,
    "Katie.Coleman@example.co.uk"
  );
  const cleared = await request(path, {
    method: "PUT",
    token: original.body.editToken,
    body: { name: "Katie", email: "", slots: [] },
  });
  assert.equal(cleared.body.participant.email, "");
  const reloaded = await anotherDevice(`/events/${event.id}`);
  assert.equal(reloaded.body.participants[0].email, "");
});

test("participant email validation allows blank input and rejects malformed or oversized addresses", async (t) => {
  const { request } = await fixture(t);
  const event = await createEvent(request);
  for (const [index, email] of [
    undefined,
    "",
    "   ",
    "a.b+tag@example.com",
    "research_team@dept.example.org",
  ].entries()) {
    const added = await request(`/events/${event.id}/participants`, {
      method: "POST",
      body: { name: `Allowed ${index}`, email, slots: [] },
    });
    assert.equal(added.status, 201, email);
    assert.equal(added.body.participant.email, email?.trim() || "");
  }
  for (const email of [
    null,
    1,
    "not-email",
    "@example.com",
    "person@",
    "person@@example.com",
    "first last@example.com",
    "person@example com",
    "person@example",
    ".person@example.com",
    "person..name@example.com",
    "person@example..com",
    "person@-example.com",
    "person@example-.com",
    "person\n@example.com",
    `${"a".repeat(65)}@example.com`,
    `${"a".repeat(64)}@${"b".repeat(190)}.com`,
  ]) {
    const invalid = await request(`/events/${event.id}/participants`, {
      method: "POST",
      body: { name: "Invalid", email, slots: [] },
    });
    assert.equal(invalid.status, 400, JSON.stringify(email));
    assert.equal(typeof invalid.body.error, "string");
  }
});

test("stored legacy participants without email remain readable and editable", async (t) => {
  const { request, directory } = await fixture(t);
  const event = await createEvent(request);
  const original = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: { name: "Legacy", slots: [] },
  });
  const file = join(directory, `${event.id}.json`);
  const legacy = JSON.parse(await readFile(file, "utf8"));
  delete legacy.participants[0].email;
  await writeFile(file, JSON.stringify(legacy));
  const shared = await request(`/events/${event.id}`);
  assert.equal(shared.body.participants[0].email, "");
  const updated = await request(
    `/events/${event.id}/participants/${original.body.participant.id}`,
    {
      method: "PUT",
      token: original.body.editToken,
      body: { name: "Legacy", slots: [] },
    }
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.body.participant.email, "");
});

test("invalid event dates, ranges, time zones and lengths receive actionable validation errors", async (t) => {
  const { request } = await fixture(t);
  const invalidInputs = [
    { title: " " },
    { title: "x".repeat(81) },
    { description: "x".repeat(1001) },
    { dates: [] },
    { dates: ["2026-02-30"] },
    { dates: ["2026-10-07", "2026-10-07"] },
    { dates: Array(32).fill("2026-10-07") },
    { startTime: "09:10" },
    { startTime: "24:00" },
    { endTime: "08:30" },
    { endTime: "09:00" },
    { timezone: "Not/A_Timezone" },
    { duration: 0 },
    { duration: -1 },
    { duration: 1.5 },
    { duration: 1441 },
    { duration: null },
    { duration: "60" },
    { duration: 120, endTime: "10:00" },
  ];
  for (const invalid of invalidInputs) {
    const response = await request("/events", {
      method: "POST",
      body: { ...eventInput, ...invalid },
    });
    assert.equal(response.status, 400, JSON.stringify(invalid));
    assert.equal(typeof response.body.error, "string");
  }
  const midnight = await createEvent(request, {
    startTime: "23:00",
    endTime: "24:00",
  });
  const added = await request(`/events/${midnight.id}/participants`, {
    method: "POST",
    body: { name: "Late shift", slots: ["2026-10-07@23:30"] },
  });
  assert.equal(added.status, 201);
});

test("new schedules persist quarter-hour slots and support short, all-day, and custom meeting lengths", async (t) => {
  const { request, directory } = await fixture(t);
  for (const duration of [1, 15, 20, 45, 480]) {
    const event = await createEvent(request, { duration });
    assert.equal(event.duration, duration);
    assert.equal(event.slotMinutes, 15);
    const shared = await request(`/events/${event.id}`);
    assert.equal(shared.body.duration, duration);
    assert.equal(shared.body.slotMinutes, 15);
    const persisted = JSON.parse(
      await readFile(join(directory, `${event.id}.json`), "utf8")
    );
    assert.equal(persisted.slotMinutes, 15);
  }
  const allDay = await createEvent(request, {
    duration: 1440,
    startTime: "00:00",
    endTime: "24:00",
  });
  assert.equal(allDay.duration, 1440);
  const event = await createEvent(request, {
    duration: 45,
    dates: ["2026-10-07"],
    startTime: "09:15",
    endTime: "10:00",
  });
  const response = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: {
      name: "Katie",
      slots: ["2026-10-07@09:15", "2026-10-07@09:30", "2026-10-07@09:45"],
    },
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.participant.slots.length, 3);
  const anotherInstance = await startServer(t, directory);
  const reloaded = await anotherInstance(`/events/${event.id}`);
  assert.equal(reloaded.body.slotMinutes, 15);
  assert.deepEqual(reloaded.body.participants, [response.body.participant]);
  const excessive = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: {
      name: "Alex",
      slots: [
        "2026-10-07@09:15",
        "2026-10-07@09:30",
        "2026-10-07@09:45",
        "2026-10-07@09:15",
      ],
    },
  });
  assert.equal(excessive.status, 400);
});

test("legacy half-hour schedules retain their boundaries and responses through reads and edits", async (t) => {
  const { request, directory } = await fixture(t);
  const event = await createEvent(request, {
    dates: ["2026-10-07"],
    startTime: "09:00",
    endTime: "10:00",
  });
  const original = await request(`/events/${event.id}/participants`, {
    method: "POST",
    body: { name: "Katie", slots: ["2026-10-07@09:00", "2026-10-07@09:30"] },
  });
  const file = join(directory, `${event.id}.json`);
  const legacy = JSON.parse(await readFile(file, "utf8"));
  delete legacy.slotMinutes;
  await writeFile(file, JSON.stringify(legacy));
  const shared = await request(`/events/${event.id}`);
  assert.equal(shared.body.slotMinutes, 30);
  assert.deepEqual(shared.body.participants, [original.body.participant]);
  const path = `/events/${event.id}/participants/${original.body.participant.id}`;
  const invalid = await request(path, {
    method: "PUT",
    token: original.body.editToken,
    body: { name: "Katie", slots: ["2026-10-07@09:15"] },
  });
  assert.equal(invalid.status, 400);
  const valid = await request(path, {
    method: "PUT",
    token: original.body.editToken,
    body: { name: "Katie", slots: ["2026-10-07@09:30"] },
  });
  assert.equal(valid.status, 200);
  const persisted = JSON.parse(await readFile(file, "utf8"));
  assert.equal(persisted.slotMinutes, undefined);
  assert.deepEqual(persisted.participants[0].slots, ["2026-10-07@09:30"]);

  // A half-hour slot must fit completely even when reading an irregular old window.
  persisted.endTime = "09:45";
  await writeFile(file, JSON.stringify(persisted));
  const partial = await request(path, {
    method: "PUT",
    token: original.body.editToken,
    body: { name: "Katie", slots: ["2026-10-07@09:30"] },
  });
  assert.equal(partial.status, 400);
});

test("availability must use the event's dates and slot boundaries; names must distinguish respondents", async (t) => {
  const { request } = await fixture(t);
  const event = await createEvent(request);
  const path = `/events/${event.id}/participants`;
  const added = await request(path, {
    method: "POST",
    body: { name: "Katie", slots: [] },
  });
  assert.equal(added.status, 201);
  const duplicate = await request(path, {
    method: "POST",
    body: { name: "  KATIE  ", slots: [] },
  });
  assert.equal(duplicate.status, 409);
  for (const body of [
    { name: "" },
    { name: "x".repeat(61) },
    { slots: "2026-10-07@09:00" },
    { slots: ["2026-10-09@09:00"] },
    { slots: ["2026-10-07@08:30"] },
    { slots: ["2026-10-07@17:00"] },
    { slots: ["2026-10-07@09:10"] },
    { slots: [null] },
  ]) {
    const response = await request(path, {
      method: "POST",
      body: { name: "Alex", slots: [], ...body },
    });
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  const second = await request(path, {
    method: "POST",
    body: { name: "Alex", slots: [] },
  });
  const duplicateEdit = await request(`${path}/${second.body.participant.id}`, {
    method: "PUT",
    token: second.body.editToken,
    body: { name: "katie", slots: [] },
  });
  assert.equal(duplicateEdit.status, 409);
});

test("simultaneous responses are persisted without overwriting one another", async (t) => {
  const { directory, request } = await fixture(t);
  const event = await createEvent(request);
  const anotherInstance = await startServer(t, directory);
  const responses = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      (index % 2 ? request : anotherInstance)(
        `/events/${event.id}/participants`,
        {
          method: "POST",
          body: { name: `Person ${index}`, slots: ["2026-10-07@09:00"] },
        }
      )
    )
  );
  assert.equal(
    responses.every((response) => response.status === 201),
    true
  );
  const saved = await request(`/events/${event.id}`);
  assert.equal(saved.body.participants.length, 20);
  assert.equal(
    new Set(saved.body.participants.map(({ name }) => name)).size,
    20
  );
  const duplicateRace = await Promise.all(
    Array.from({ length: 2 }, () =>
      request(`/events/${event.id}/participants`, {
        method: "POST",
        body: { name: "Same name", slots: [] },
      })
    )
  );
  assert.deepEqual(
    duplicateRace.map(({ status }) => status).sort(),
    [201, 409]
  );
});

test("unknown schedules, routes, unsupported methods and malformed bodies return JSON errors", async (t) => {
  const { request } = await fixture(t);
  for (const path of [
    "/events/not-a-schedule",
    "/events/00000000-0000-0000-0000-000000000000",
    "/unknown",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 404);
    assert.equal(typeof response.body.error, "string");
  }
  assert.equal((await request("/events")).status, 405);
  assert.equal(
    (await request("/events", { method: "POST", body: null })).status,
    400
  );
  assert.equal(
    (await request("/events", { method: "POST", body: [] })).status,
    400
  );
  assert.equal(
    (await request("/events", { method: "POST", rawBody: "{broken" })).status,
    400
  );
  assert.equal(
    (
      await request("/events", {
        method: "POST",
        body: eventInput,
        contentType: "text/plain",
      })
    ).status,
    415
  );
  assert.equal(
    (
      await request("/events", {
        method: "POST",
        body: { ...eventInput, description: "x".repeat(200000) },
      })
    ).status,
    413
  );
});
