/* eslint-env node */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Load this browser-only module as ESM without changing the project's package type.
const source = await readFile(
  new URL("../src/utils/scheduleApi.js", import.meta.url),
  "utf8"
);
const {
  identityKey,
  rememberedIdentities,
  rememberIdentity,
  selectIdentity,
  forgetIdentity,
} = await import(
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
  assert.equal(forgetIdentity("event", first.id), false);
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

test("forgetting an inactive participant preserves the active person, other tokens, and other events", (t) => {
  const { values } = storageFixture(t, {
    [identityKey("event")]: JSON.stringify(first),
    "schedule:identities:event": JSON.stringify([first, second, third]),
    [identityKey("other")]: JSON.stringify(second),
    "schedule:identities:other": JSON.stringify([second]),
  });
  assert.equal(forgetIdentity("event", second.id), true);
  assert.deepEqual(rememberedIdentities("event"), [first, third]);
  assert.deepEqual(JSON.parse(values.get(identityKey("event"))), first);
  assert.deepEqual(rememberedIdentities("other"), [second]);
  assert.deepEqual(JSON.parse(values.get(identityKey("other"))), second);
});

test("forgetting the active participant cannot resurrect it through legacy migration", (t) => {
  const { values } = storageFixture(t, {
    [identityKey("event")]: JSON.stringify(second),
    "schedule:identities:event": JSON.stringify([first, second, third]),
  });
  assert.equal(forgetIdentity("event", second.id), true);
  assert.equal(values.get(identityKey("event")), "null");
  assert.deepEqual(rememberedIdentities("event"), [first, third]);
  assert.equal(selectIdentity("event", first), true);
  assert.deepEqual(rememberedIdentities("event"), [first, third]);
  assert.equal(forgetIdentity("event", second.id), true);
  assert.deepEqual(JSON.parse(values.get(identityKey("event"))), first);
});

test("forgetting a legacy-only active identity stays forgotten when another person is added", (t) => {
  const { values } = storageFixture(t, {
    [identityKey("event")]: JSON.stringify(first),
  });
  assert.equal(forgetIdentity("event", first.id), true);
  assert.equal(values.get(identityKey("event")), "null");
  assert.deepEqual(rememberedIdentities("event"), []);
  assert.equal(rememberIdentity("event", second), true);
  assert.deepEqual(rememberedIdentities("event"), [second]);
});

test("forgetting another person retains an active legacy token during migration", (t) => {
  const { values } = storageFixture(t, {
    [identityKey("event")]: JSON.stringify(first),
    "schedule:identities:event": JSON.stringify([second, third]),
  });
  assert.equal(forgetIdentity("event", second.id), true);
  assert.deepEqual(rememberedIdentities("event"), [third, first]);
  assert.deepEqual(JSON.parse(values.get(identityKey("event"))), first);
});

test("failed active-pointer cleanup reports failure without dropping remembered people", (t) => {
  const { values, storage } = storageFixture(t, {
    [identityKey("event")]: JSON.stringify(first),
    "schedule:identities:event": JSON.stringify([first, second]),
  });
  const setItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === identityKey("event")) throw new Error("Storage blocked");
    setItem(key, value);
  };
  assert.equal(forgetIdentity("event", first.id), false);
  assert.deepEqual(JSON.parse(values.get(identityKey("event"))), first);
  assert.deepEqual(rememberedIdentities("event"), [first, second]);
});

test("failed collection cleanup reports failure and preserves other remembered people", (t) => {
  const { values, storage } = storageFixture(t, {
    [identityKey("event")]: JSON.stringify(first),
    "schedule:identities:event": JSON.stringify([first, second]),
  });
  const setItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === "schedule:identities:event") throw new Error("Storage full");
    setItem(key, value);
  };
  assert.equal(forgetIdentity("event", first.id), false);
  assert.equal(values.get(identityKey("event")), "null");
  assert.deepEqual(rememberedIdentities("event"), [first, second]);
  storage.setItem = setItem;
  assert.equal(forgetIdentity("event", first.id), true);
  assert.deepEqual(rememberedIdentities("event"), [second]);
});
