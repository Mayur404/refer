import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeActivity,
  mergeActivity,
  buildCalendarYear,
} from "../src/utils/activity.js";
import { summarizeSolved } from "../src/utils/profileSummary.js";

test("activity handles provider JSON strings, timestamps, and date keys", () => {
  assert.deepEqual(normalizeActivity('{"1792108800":2,"2026-10-16":3}'), {
    "2026-10-16": 5,
  });
  assert.equal(normalizeActivity("bad json"), null);
  assert.equal(normalizeActivity({ error: "unavailable" }), null);
  assert.equal(normalizeActivity({ "2026-02-31": 2 }), null);
  assert.deepEqual(normalizeActivity({}), {});
});

test("all-time calendars preserve old activity and leap days, and stop at today", () => {
  const activity = mergeActivity([
    { "2024-02-29": 2 },
    { "2024-02-29": 3 },
    null,
  ]);
  const days = buildCalendarYear(
    activity,
    2024,
    new Date("2026-10-17T12:00:00Z"),
  );
  assert.equal(days.length, 366);
  assert.equal(days.find((day) => day.date === "2024-02-29").count, 5);
  const current = buildCalendarYear({}, 2026, new Date("2026-10-17T12:00:00Z"));
  assert.equal(current.at(-1).date, "2026-10-17");
  assert.deepEqual(
    buildCalendarYear({}, 2027, new Date("2026-10-17T12:00:00Z")),
    [],
  );
});

test("combined activity excludes missing feeds without inventing zero data", () => {
  assert.equal(mergeActivity([null, undefined]), null);
  assert.deepEqual(
    mergeActivity([{ "2026-10-16": 2 }, null, { "2026-10-16": 3 }]),
    { "2026-10-16": 5 },
  );
});

test("total solved distinguishes missing counts from genuine zero values", () => {
  const states = {
    leetcode: { data: { totalSolved: 0 } },
    codeforces: { data: { totalSolved: 25 } },
    codechef: { data: { totalSolved: null } },
  };
  assert.deepEqual(
    summarizeSolved(states, {
      leetcode: "one",
      codeforces: "two",
      codechef: "three",
    }),
    { total: 25, partial: true },
  );
  assert.deepEqual(summarizeSolved(states, { leetcode: "one" }), {
    total: 0,
    partial: false,
  });
  assert.deepEqual(summarizeSolved({}, { leetcode: "one" }), {
    total: null,
    partial: true,
  });
});
test("missing or malformed activity counts are not invented as zero", () => {
  assert.equal(
    normalizeActivity({
      "2026-10-01": null,
      "2026-10-02": false,
      "2026-10-03": [],
    }),
    null,
  );
  assert.deepEqual(
    normalizeActivity({ "2026-10-01": "2", "": 3, "2026-02-30": 4 }),
    { "2026-10-01": 2 },
  );
});
