import test from "node:test";
import assert from "node:assert/strict";
import {
  getPlatformProfile,
  validatePlatformHandle,
} from "../src/services/profiles.js";

test("all platform handles are validated before requests", () => {
  assert.ok(validatePlatformHandle("", "leetcode"));
  assert.ok(validatePlatformHandle("../other", "codechef"));
  assert.equal(validatePlatformHandle("neal_wu", "leetcode"), "");
  assert.equal(validatePlatformHandle("gennady.korotkevich", "codechef"), "");
});

test("a fresh cached LeetCode rating without history is refreshed for the graph", async (t) => {
  const profile = {
    handle: "stale_history",
    totalSolved: 10,
    rating: 1600,
    ratingStatus: "available",
    ratingHistory: [],
    heatmap: null,
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) =>
        key === "cpsync.profile.leetcode"
          ? JSON.stringify({
              version: 1,
              handle: "stale_history",
              time: Date.now(),
              profile,
            })
          : null,
      setItem: () => {},
    },
  });
  t.after(() => delete globalThis.localStorage);
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "/api/leetcode/profile?handle=stale_history");
    return new Response(
      JSON.stringify({
        data: {
          matchedUser: {
            username: "stale_history",
            submitStatsGlobal: {
              acSubmissionNum: [{ difficulty: "All", count: 11 }],
            },
          },
          userContestRanking: { rating: 1650, attendedContestsCount: 1 },
          userContestRankingHistory: [
            {
              attended: true,
              rating: 1650,
              contest: { title: "Weekly", startTime: 1792108800 },
            },
          ],
        },
      }),
    );
  });
  const result = await getPlatformProfile("leetcode", "stale_history");
  assert.equal(result.ratingHistory.length, 1);
  assert.equal(result.totalSolved, 11);
});

test("LeetCode solved counts survive a failed rating request", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.endsWith("/contest")) throw new TypeError("Offline");
    return new Response(
      JSON.stringify({
        totalSolved: 120,
        easySolved: 40,
        mediumSolved: 60,
        hardSolved: 20,
      }),
    );
  });
  const result = await getPlatformProfile("leetcode", "neal_wu");
  assert.equal(result.totalSolved, 120);
  assert.equal(result.easySolved, 40);
  assert.ok(Array.isArray(result.ratingHistory));
  assert.equal(result.rating, null);
  assert.match(result.warning, /unavailable/);
  assert.equal(result.url, "https://leetcode.com/u/neal_wu");
});

test("CodeChef preserves actual ratings without inventing contest history", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          handle: "tourist",
          stars: "7?",
          rating: 3355,
          maxRating: 3445,
          attendedContests: 2,
          totalSolved: 632,
          globalRanking: null,
          ratingHistory: [
            { date: "2026-01-01", rating: 3355, contest: "Starters" },
          ],
          url: "https://www.codechef.com/users/tourist",
        }),
      ),
  );
  const result = await getPlatformProfile("codechef", "tourist");
  assert.equal(result.rating, 3355);
  assert.equal(result.maxRating, 3445);
  assert.equal(result.attendedContests, 2);
  assert.equal(result.globalRanking, null);
  assert.equal(result.ratingHistory.length, 1);
  assert.equal(result.totalSolved, 632);
  assert.equal(result.url, "https://www.codechef.com/users/tourist");
});

test("a successful HTTP response with an invalid profile still reports an error", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ error: "User not found" })),
  );
  await assert.rejects(getPlatformProfile("codechef", "missing"), /not found/);
  await assert.rejects(getPlatformProfile("leetcode", "missing"), /not found/);
});

test("invalid profile values are rejected before rendering or caching", async (t) => {
  for (const data of [
    { handle: "broken", ratingHistory: [null] },
    { handle: "broken", totalSolved: -1, ratingHistory: [] },
    { handle: "broken", rank: {}, ratingHistory: [] },
    { handle: "broken", ratingHistory: [{ date: "2026-02-30", rating: 1000 }] },
    { handle: "broken", heatmap: { "2026-02-30": 2 }, ratingHistory: [] },
  ]) {
    t.mock.method(globalThis, "fetch", async () => Response.json(data));
    await assert.rejects(
      getPlatformProfile("codechef", "broken", undefined, true),
      /incomplete profile/,
    );
  }
});

test("profile links are constructed from the official platform and handle", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      handle: "safe_user",
      ratingHistory: [],
      url: "javascript:alert(1)",
    }),
  );
  const profile = await getPlatformProfile("codechef", "safe_user");
  assert.equal(profile.url, "https://www.codechef.com/users/safe_user");
  assert.equal(profile.totalSolved, null);
  assert.equal(profile.ratingStatus, "unavailable");
});

test("invalid profile arguments and cancelled requests never call providers", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({}),
  );
  for (const [platform, handle] of [
    ["constructor", "tester"],
    ["codechef", "../bad"],
    ["leetcode", null],
  ]) {
    await assert.rejects(getPlatformProfile(platform, handle));
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    getPlatformProfile("codechef", "tourist", controller.signal),
    { name: "AbortError" },
  );
  assert.equal(fetch.mock.callCount(), 0);
});
