import test from "node:test";
import assert from "node:assert/strict";

const solved = {
  totalSolved: 10,
  easySolved: 2,
  mediumSolved: 5,
  hardSolved: 3,
  submissionCalendar: { 1792108800: 4 },
};

const official = {
  data: {
    matchedUser: {
      username: "tester",
      submitStatsGlobal: {
        acSubmissionNum: [
          { difficulty: "All", count: 10 },
          { difficulty: "Easy", count: 2 },
          { difficulty: "Medium", count: 5 },
          { difficulty: "Hard", count: 3 },
        ],
      },
      userCalendar: { submissionCalendar: '{"1792108800":4}' },
    },
    userContestRanking: {
      rating: 1700.4,
      attendedContestsCount: 2,
      globalRanking: 123,
    },
    userContestRankingHistory: [
      {
        attended: true,
        rating: 1700.4,
        contest: { title: "Later", startTime: 1792108800 },
      },
      {
        attended: false,
        rating: 1500,
        contest: { title: "Not attended", startTime: 1792022400 },
      },
      {
        attended: true,
        rating: 1600,
        contest: { title: "Earlier", startTime: 1791936000 },
      },
    ],
  },
};

test("official LeetCode profile retains the real contest graph and ignores non-attended contests", async () => {
  const { normalizeOfficialLeetCodeProfile } =
    await import("../src/services/leetcode.js");
  const profile = normalizeOfficialLeetCodeProfile(official, "tester");
  assert.equal(profile.totalSolved, 10);
  assert.equal(profile.rating, 1700);
  assert.equal(profile.maxRating, 1700);
  assert.equal(profile.globalRanking, 123);
  assert.deepEqual(
    profile.ratingHistory.map((point) => point.contest),
    ["Earlier", "Later"],
  );
  assert.equal(profile.ratingHistory[1].date, "2026-10-16");
  assert.deepEqual(profile.heatmap, { "2026-10-16": 4 });
});

test("official server profile loads history without calling community feeds", async (t) => {
  const { getLeetCodeProfile } =
    await import("../src/services/leetcode.js?case=official");
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "/api/leetcode/profile?handle=tester");
    return new Response(JSON.stringify(official));
  });
  const profile = await getLeetCodeProfile("tester");
  assert.equal(profile.ratingHistory.length, 2);
});

test("official server query requests contest history and preserves upstream not-found errors", async (t) => {
  const { getOfficialLeetCodeProfile } = await import("../server/leetcode.js");
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://leetcode.com/graphql");
    const body = JSON.parse(options.body);
    assert.match(body.query, /userContestRankingHistory/);
    assert.equal(body.variables.username, "tester");
    return new Response(JSON.stringify(official));
  });
  const response = await getOfficialLeetCodeProfile("tester");
  assert.equal(response.data.userContestRankingHistory.length, 3);
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ data: { matchedUser: null } })),
  );
  await assert.rejects(getOfficialLeetCodeProfile("missing"), { status: 404 });
});

test("community fallback preserves GraphQL history when the provider supplies it", async (t) => {
  const { getLeetCodeProfile } =
    await import("../src/services/leetcode.js?case=fallback-history");
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.startsWith("/api/"))
      return new Response("Unavailable", { status: 502 });
    if (url.includes("alfa-leetcode"))
      return new Response("Rate limited", { status: 429 });
    return new Response(
      JSON.stringify(url.includes("faisalshohag") ? solved : official),
    );
  });
  const profile = await getLeetCodeProfile("tester");
  assert.equal(profile.ratingHistory.length, 2);
});

test("HTTP 429 switches feeds and suppresses repeat primary calls for the session", async (t) => {
  const { getLeetCodeProfile } =
    await import("../src/services/leetcode.js?case=rate-limit");
  let primaryCalls = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.includes("alfa-leetcode")) {
      primaryCalls++;
      return new Response("Too many requests", { status: 429 });
    }
    if (url.includes("faisalshohag"))
      return new Response(JSON.stringify(solved));
    return new Response(
      JSON.stringify({
        data: {
          matchedUser: { username: "tester" },
          userContestRanking: { rating: 1600.6, attendedContestsCount: 2 },
        },
      }),
    );
  });
  const first = await getLeetCodeProfile("tester");
  const second = await getLeetCodeProfile("other");
  assert.equal(primaryCalls, 1);
  assert.equal(first.totalSolved, 10);
  assert.equal(first.rating, 1601);
  assert.equal(first.ratingStatus, "available");
  assert.equal(second.totalSolved, 10);
  assert.match(first.warning, /secondary/);
});

test("an unavailable ranking is not reported as an unrated profile", async (t) => {
  const { getLeetCodeProfile } =
    await import("../src/services/leetcode.js?case=missing-rating");
  t.mock.method(
    globalThis,
    "fetch",
    async (url) =>
      new Response(JSON.stringify(url.endsWith("/profile") ? solved : {})),
  );
  const profile = await getLeetCodeProfile("tester");
  assert.equal(profile.rating, null);
  assert.equal(profile.ratingStatus, "unavailable");
  assert.equal(profile.totalSolved, 10);
  assert.match(profile.warning, /ratings are unavailable/);
});

test("a genuinely unrated account with zero solved problems remains valid", async (t) => {
  const { getLeetCodeProfile } =
    await import("../src/services/leetcode.js?case=unrated");
  t.mock.method(
    globalThis,
    "fetch",
    async (url) =>
      new Response(
        JSON.stringify(
          url.endsWith("/profile")
            ? {
                totalSolved: 0,
                easySolved: 0,
                mediumSolved: 0,
                hardSolved: 0,
                submissionCalendar: {},
              }
            : { contestAttend: 0, contestParticipation: [] },
        ),
      ),
  );
  const profile = await getLeetCodeProfile("new_user");
  assert.equal(profile.totalSolved, 0);
  assert.equal(profile.ratingStatus, "unrated");
  assert.deepEqual(profile.heatmap, {});
});

test("GraphQL user errors in HTTP 200 responses are recognised", async (t) => {
  const { getLeetCodeProfile } =
    await import("../src/services/leetcode.js?case=not-found");
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          errors: [{ message: "That user does not exist." }],
          data: { matchedUser: null },
        }),
      ),
  );
  await assert.rejects(getLeetCodeProfile("missing_user"), /user not found/);
});

test("ranking history is chronological and excludes non-participated contests", async () => {
  const { normalizeLeetCodeRanking } =
    await import("../src/services/leetcode.js");
  const result = normalizeLeetCodeRanking({
    contestRating: 1700.4,
    contestAttend: 2,
    contestParticipation: [
      { rating: 1700, contest: { title: "Later", startTime: 2000 } },
      { rating: 1500, contest: { title: "Earlier", startTime: 1000 } },
      {
        rating: 2000,
        attended: false,
        contest: { title: "Not attended", startTime: 3000 },
      },
    ],
  });
  assert.deepEqual(
    result.ratingHistory.map((point) => point.contest),
    ["Earlier", "Later"],
  );
  assert.equal(result.ratingHistory[1].rating, 1700);
});

test("contest fallback preserves the real 90-minute duration and official slug", async (t) => {
  const { getLeetCodeContests } =
    await import("../src/services/leetcode.js?case=contests");
  t.mock.method(globalThis, "fetch", async (url) =>
    url.includes("alfa-leetcode")
      ? new Response("", { status: 429 })
      : new Response(
          JSON.stringify({
            data: {
              topTwoContests: [
                {
                  title: "Biweekly Contest 194",
                  startTime: 1792852200,
                  duration: 5400,
                },
              ],
            },
          }),
        ),
  );
  const result = await getLeetCodeContests();
  assert.equal(result[0].duration, 5400);
  assert.equal(result[0].titleSlug, "biweekly-contest-194");
});
