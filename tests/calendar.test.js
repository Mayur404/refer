import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleCalendarUrl } from "../src/utils/calendar.js";

const contest = {
  id: "codeforces-1234",
  platform: "codeforces",
  name: "Codeforces Round",
  url: "https://codeforces.com/contest/1234",
  startTimeSeconds: Date.parse("2026-10-16T23:30:00Z") / 1000,
  durationSeconds: 7200,
};

test("Google Calendar receives exact UTC dates and duration across midnight", () => {
  const url = new URL(createGoogleCalendarUrl(contest));
  assert.equal(url.origin, "https://calendar.google.com");
  assert.equal(url.pathname, "/calendar/r/eventedit");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(
    url.searchParams.get("dates"),
    "20261016T233000Z/20261017T013000Z",
  );
});

test("event titles are URL encoded without creating unintended query parameters", () => {
  const name = "Round & Division 2? #1 + 🧩";
  const url = new URL(createGoogleCalendarUrl({ ...contest, name }));
  assert.equal(url.searchParams.get("text"), name);
  assert.equal(url.searchParams.get("location"), contest.url);
  assert.equal([...url.searchParams].length, 5);
});

test("all three platforms keep their own official contest links", () => {
  for (const [platform, url] of [
    ["codeforces", contest.url],
    ["leetcode", "https://leetcode.com/contest/weekly-contest-524/"],
    ["codechef", "https://www.codechef.com/START261"],
  ]) {
    const result = new URL(
      createGoogleCalendarUrl({ ...contest, platform, url }),
    );
    assert.equal(result.searchParams.get("location"), url);
    assert.ok(result.searchParams.get("details").includes(url));
  }
});

test("invalid schedules and untrusted links cannot create calendar links", () => {
  for (const invalid of [
    { durationSeconds: 0 },
    { startTimeSeconds: NaN },
    { url: "https://example.com/contest" },
    { platform: "unknown" },
    { name: "" },
  ]) {
    assert.throws(
      () => createGoogleCalendarUrl({ ...contest, ...invalid }),
      /valid calendar details/,
    );
  }
});
