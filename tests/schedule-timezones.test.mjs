import test from "node:test";
import assert from "node:assert/strict";
import {
  detectTimeZone,
  getTimeZoneGroups,
  isValidTimeZone,
} from "../src/utils/scheduleTimezones.mjs";

const values = (groups) =>
  groups.flatMap(({ options }) => options.map(({ value }) => value));

test("United States leads with familiar zones and keeps Arizona distinct", () => {
  const groups = getTimeZoneGroups();
  assert.equal(groups[0].label, "United States");
  assert.deepEqual(values([groups[0]]).slice(0, 8), [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Phoenix",
    "America/Adak",
  ]);
  assert.equal(groups[1].label, "UTC");
  assert.ok(values([groups[1]]).includes("UTC"));
  const arizona = groups[0].options.find(
    ({ value }) => value === "America/Phoenix"
  );
  const mountain = groups[0].options.find(
    ({ value }) => value === "America/Denver"
  );
  assert.notEqual(arizona.label, mountain.label);
});

test("country groups cover the world, are alphabetical, and contain valid unique zones", () => {
  const groups = getTimeZoneGroups();
  const countryLabels = groups.slice(2).map(({ label }) => label);
  assert.deepEqual(
    countryLabels,
    [...countryLabels].sort((a, b) => a.localeCompare(b, "en"))
  );
  const allValues = values(groups);
  assert.equal(new Set(allValues).size, allValues.length);
  for (const group of groups) {
    assert.ok(group.options.length > 0, `${group.label} has choices`);
    for (const option of group.options) {
      assert.doesNotThrow(
        () => new Intl.DateTimeFormat("en", { timeZone: option.value })
      );
      assert.ok(option.label.trim().length > 0);
    }
  }
  assert.equal(allValues.includes("America/Boise"), false);
  for (const [country, zone] of [
    ["United Kingdom", "Europe/London"],
    ["France", "Europe/Paris"],
    ["Japan", "Asia/Tokyo"],
    ["India", "Asia/Kolkata"],
    ["South Africa", "Africa/Johannesburg"],
    ["Brazil", "America/Sao_Paulo"],
    ["Canada", "America/Toronto"],
    ["New Zealand", "Pacific/Auckland"],
    ["Mexico", "America/Mexico_City"],
    ["Russia", "Europe/Moscow"],
  ]) {
    const group = groups.find(({ label }) => label === country);
    assert.ok(
      group?.options.some(({ value }) => value === zone),
      `${country} includes ${zone}`
    );
  }
  for (const group of groups.slice(2)) {
    for (const option of group.options) {
      assert.ok(option.label.startsWith(`${group.label} — `), option.label);
    }
  }
});

test("regions with different seasonal clock rules remain separate choices", () => {
  const groups = getTimeZoneGroups();
  const australia = groups.find(({ label }) => label === "Australia");
  const adelaide = australia.options.find(
    ({ value }) => value === "Australia/Adelaide"
  );
  const darwin = australia.options.find(
    ({ value }) => value === "Australia/Darwin"
  );
  assert.ok(adelaide);
  assert.ok(darwin);
  assert.notEqual(adelaide.label, darwin.label);
});

test("extra saved and device zones retain exact aliases, skip invalid values, and deduplicate", () => {
  const groups = getTimeZoneGroups([
    "America/Boise",
    "Asia/Calcutta",
    "America/Boise",
    "Asia/Calcutta",
    "America/New_York",
    "UTC",
    "Invalid/Timezone",
    "",
    null,
    undefined,
  ]);
  const extra = groups.at(-1);
  assert.equal(extra.label, "Your device or saved time zone");
  assert.deepEqual(values([extra]), ["America/Boise", "Asia/Calcutta"]);
  const allValues = values(groups);
  assert.ok(allValues.includes("Asia/Kolkata"));
  assert.ok(allValues.includes("Asia/Calcutta"));
  assert.equal(new Set(allValues).size, allValues.length);
  assert.equal(
    getTimeZoneGroups(["Invalid/Timezone"]).some(
      ({ label }) => label === extra.label
    ),
    false
  );
});

test("timezone validation accepts supported aliases and rejects malformed or missing values", () => {
  for (const zone of [
    "UTC",
    "America/Boise",
    "Asia/Calcutta",
    "Asia/Kolkata",
  ]) {
    assert.equal(isValidTimeZone(zone), true, zone);
  }
  for (const zone of ["Invalid/Timezone", "", undefined, null, 42]) {
    assert.equal(isValidTimeZone(zone), false, String(zone));
  }
});

test("device detection preserves the exact zone and falls back safely", (t) => {
  const OriginalDateTimeFormat = Intl.DateTimeFormat;
  let detected = "America/Boise";
  let throws = false;
  t.mock.method(Intl, "DateTimeFormat", function (locales, options) {
    if (options?.timeZone) return new OriginalDateTimeFormat(locales, options);
    if (throws) throw new Error("Device timezone unavailable");
    return { resolvedOptions: () => ({ timeZone: detected }) };
  });
  assert.equal(detectTimeZone(), "America/Boise");
  detected = undefined;
  assert.equal(detectTimeZone(), "UTC");
  detected = "Invalid/Timezone";
  assert.equal(detectTimeZone(), "UTC");
  throws = true;
  assert.equal(detectTimeZone(), "UTC");
});
