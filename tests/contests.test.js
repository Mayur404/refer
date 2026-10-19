import test from "node:test";
import assert from "node:assert/strict";
import { normalizeContest, getContests } from "../src/services/contests.js";

const start = Math.floor(Date.now() / 1000) + 86400;

test("normalization preserves platform-specific official links and durations", () => {
  const contest = normalizeContest(
    {
      name: "Starters 261",
      url: "https://www.codechef.com/START261",
      startTimeSeconds: start,
      durationSeconds: 7200,
    },
    "codechef",
  );
  assert.equal(contest.id, "codechef-START261");
  assert.equal(contest.url, "https://www.codechef.com/START261");
  assert.equal(contest.phase, "BEFORE");
  assert.equal(contest.durationSeconds, 7200);
});

test("expired, incomplete, and untrusted contests are excluded", () => {
  const item = {
    name: "Weekly",
    url: "https://leetcode.com/contest/weekly-contest-524/",
    startTimeSeconds: start,
    durationSeconds: 5400,
  };
  assert.equal(
    normalizeContest(
      { ...item, url: "https://example.com/phishing" },
      "leetcode",
    ),
    null,
  );
  assert.equal(
    normalizeContest({ ...item, url: "javascript:alert(1)" }, "leetcode"),
    null,
  );
  assert.equal(
    normalizeContest({ ...item, durationSeconds: NaN }, "leetcode"),
    null,
  );
  assert.equal(normalizeContest(item, "leetcode", (start + 5401) * 1000), null);
  assert.equal(
    normalizeContest(item, "leetcode", (start + 1) * 1000).phase,
    "CODING",
  );
});

test("malformed names, null entries, and out-of-range dates are excluded", () => {
  const item = {
    name: "Weekly",
    url: "https://leetcode.com/contest/weekly-contest-524/",
    startTimeSeconds: start,
    durationSeconds: 5400,
  };
  for (const value of [
    null,
    { ...item, name: {} },
    { ...item, name: " " },
    { ...item, startTimeSeconds: 1e20 },
    { ...item, durationSeconds: 1e20 },
  ]) {
    assert.equal(normalizeContest(value, "leetcode"), null);
  }
});

test("one failed feed does not remove healthy platform contests", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.includes("alfa-leetcode")) throw new TypeError("Offline");
    if (url.includes("codeforces.com/api"))
      return new Response(
        JSON.stringify({
          status: "OK",
          result: [
            {
              id: 123,
              name: "Round 123",
              startTimeSeconds: start,
              durationSeconds: 7200,
              phase: "BEFORE",
            },
          ],
        }),
      );
    return new Response(
      JSON.stringify([
        {
          name: "Starters",
          startTimeSeconds: start,
          durationSeconds: 7200,
          url: "https://www.codechef.com/START261",
        },
      ]),
    );
  });
  const result = await getContests(undefined, true);
  assert.deepEqual(
    result.contests.map((item) => item.platform),
    ["codeforces", "codechef"],
  );
  assert.equal(
    result.sources.find((item) => item.platform === "leetcode").ok,
    false,
  );
  assert.equal(
    result.sources.find((item) => item.platform === "codechef").ok,
    true,
  );
});
