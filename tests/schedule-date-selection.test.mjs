import assert from "node:assert/strict";
import test from "node:test";
import { selectDateRectangle } from "../src/utils/scheduleDateSelection.mjs";

const calendarDates = [
  null,
  null,
  null,
  ...Array.from(
    { length: 31 },
    (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`
  ),
];

function select(options) {
  return selectDateRectangle({
    calendarDates,
    selectedDates: [],
    startIndex: 7,
    endIndex: 15,
    minimumDate: "2026-10-01",
    ...options,
  });
}

test("dragging across weeks selects a rectangle, in either direction", () => {
  const expected = ["2026-10-05", "2026-10-06", "2026-10-12", "2026-10-13"];
  assert.deepEqual(select({}), expected);
  assert.deepEqual(select({ startIndex: 15, endIndex: 7 }), expected);
});

test("shrinking a selection preserves the original dates outside its rectangle", () => {
  const original = ["2026-10-06", "2026-11-02"];
  assert.deepEqual(select({ selectedDates: original }), [
    "2026-10-05",
    "2026-10-06",
    "2026-10-12",
    "2026-10-13",
    "2026-11-02",
  ]);
  assert.deepEqual(select({ selectedDates: original, endIndex: 7 }), [
    "2026-10-05",
    "2026-10-06",
    "2026-11-02",
  ]);
  assert.deepEqual(original, ["2026-10-06", "2026-11-02"]);
});

test("removal clears only rectangle dates and retains other selected months", () => {
  assert.deepEqual(
    select({
      selectedDates: ["2026-10-05", "2026-10-06", "2026-10-07", "2026-11-02"],
      remove: true,
    }),
    ["2026-10-07", "2026-11-02"]
  );
});

test("empty calendar cells and past dates are ignored", () => {
  assert.deepEqual(
    select({ startIndex: 0, endIndex: 6, minimumDate: "2026-10-03" }),
    ["2026-10-03", "2026-10-04"]
  );
});

test("adding stops at the limit while preserving existing selections", () => {
  assert.deepEqual(select({ selectedDates: ["2026-11-02"], maxDates: 3 }), [
    "2026-10-05",
    "2026-10-06",
    "2026-11-02",
  ]);
  assert.deepEqual(select({ selectedDates: ["2026-11-02"], maxDates: 1 }), [
    "2026-11-02",
  ]);
});

test("the default 31-date cap counts selections in other months", () => {
  const selected = select({
    selectedDates: ["2026-11-02"],
    startIndex: 0,
    endIndex: 34,
  });
  assert.equal(selected.length, 31);
  assert.ok(selected.includes("2026-11-02"));
  assert.ok(!selected.includes("2026-10-31"));
});
