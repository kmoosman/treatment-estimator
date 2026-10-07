/* eslint-env node */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Load this browser-only module as ESM without changing the project's package type.
const source = await readFile(
  new URL("../src/utils/scheduleApi.js", import.meta.url),
  "utf8"
);
const { identityKey, rememberedIdentities, rememberIdentity, selectIdentity } =
  await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
const first = { id: "participant-a", editToken: "test-token-a" };
const second = { id: "participant-b", editToken: "test-token-b" };
const third = { id: "participant-c", editToken: "test-token-c" };

function storageFixture(t, records = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map(Object.entries(records));
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
  return { values, storage };
}

test("legacy active identities migrate without losing access when starting a new response", (t) => {
  const { values } = storageFixture(t, {
    [identityKey("event")]: JSON.stringify(first),
  });
  assert.equal(selectIdentity("event", null), true);
  assert.equal(values.get(identityKey("event")), "null");
  assert.deepEqual(rememberedIdentities("event"), [first]);
  assert.deepEqual(JSON.parse(values.get("schedule:identities:event")), [
    first,
  ]);
});

test("three participants stay remembered while switching and clearing the active selection", (t) => {
  const { values } = storageFixture(t);
  for (const identity of [first, second, third])
    assert.equal(rememberIdentity("event", identity), true);
  assert.deepEqual(rememberedIdentities("event"), [first, second, third]);
  const collection = values.get("schedule:identities:event");
  assert.equal(selectIdentity("event", first), true);
  assert.deepEqual(JSON.parse(values.get(identityKey("event"))), first);
  assert.equal(values.get("schedule:identities:event"), collection);
  assert.equal(selectIdentity("event", null), true);
  assert.equal(values.get("schedule:identities:event"), collection);
  assert.deepEqual(rememberedIdentities("event"), [first, second, third]);
  assert.deepEqual(rememberedIdentities("other-event"), []);
});

test("remembering a refreshed token merges legacy and collection entries without duplicating participants", (t) => {
  storageFixture(t, {
    [identityKey("event")]: JSON.stringify(first),
    "schedule:identities:event": JSON.stringify([
      second,
      null,
      { id: "invalid" },
      { id: "", editToken: "invalid" },
    ]),
  });
  assert.deepEqual(rememberedIdentities("event"), [second, first]);
  const refreshed = {
    ...first,
    editToken: "test-token-a-refreshed",
    extra: "not retained",
  };
  assert.equal(rememberIdentity("event", refreshed), true);
  assert.deepEqual(rememberedIdentities("event"), [
    second,
    { id: first.id, editToken: refreshed.editToken },
  ]);
  assert.equal(rememberIdentity("event", { id: "missing-token" }), false);
  assert.equal(selectIdentity("event", undefined), false);
});

test("unavailable storage returns safe defaults and reports unsuccessful writes", (t) => {
  const { storage } = storageFixture(t);
  storage.getItem = () => {
    throw new Error("Storage blocked");
  };
  storage.setItem = () => {
    throw new Error("Storage blocked");
  };
  assert.deepEqual(rememberedIdentities("event"), []);
  assert.equal(rememberIdentity("event", first), false);
  assert.equal(selectIdentity("event", first), false);
  assert.equal(selectIdentity("event", null), false);
});

test("a failed legacy migration does not clear the only saved identity", (t) => {
  const { values, storage } = storageFixture(t, {
    [identityKey("event")]: JSON.stringify(first),
  });
  storage.setItem = () => {
    throw new Error("Storage full");
  };
  assert.deepEqual(rememberedIdentities("event"), [first]);
  assert.equal(selectIdentity("event", null), false);
  assert.deepEqual(JSON.parse(values.get(identityKey("event"))), first);
  assert.equal(values.has("schedule:identities:event"), false);
});
