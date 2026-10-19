import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProfile,
  parseContests,
  parseRecentActivity,
  getCodeChefProfile,
} from "../server/codechef.js";

const html = `<meta content="CodeChef User profile of example">
<div class="rating-number">1825</div><small>(Highest Rating 1900)</small>
<div class="rating-star"><span>&#9733;</span><span>&#9733;</span></div>
<h3>Total Problems Solved: 102</h3>
<script>var all_rating = [{"rating":"1825","end_date":"2026-10-14 22:00:00","name":"Starters 260"}];</script>`;

test("official CodeChef profile supplies solved count, stars and real rating history", () => {
  const profile = parseProfile(html, "example");
  assert.equal(profile.totalSolved, 102);
  assert.equal(profile.rating, 1825);
  assert.equal(profile.maxRating, 1900);
  assert.equal(profile.stars, "2★");
  assert.deepEqual(profile.ratingHistory, [
    { date: "2026-10-14", rating: 1825, contest: "Starters 260" },
  ]);
  assert.equal(profile.attendedContests, 1);
});

test("missing profile values stay unknown and invalid users fail", () => {
  const profile = parseProfile(
    '<meta content="User profile of example">Unrated',
    "example",
  );
  assert.equal(profile.totalSolved, null);
  assert.equal(profile.rating, null);
  assert.equal(profile.ratingStatus, "unrated");
  assert.equal(profile.attendedContests, null);
  assert.throws(() => parseProfile("User not found", "missing"), /not found/);
});

test("recent submissions count rows once, despite repeated tooltips", () => {
  assert.deepEqual(
    parseRecentActivity(`<tr><td title="14/10/26"><span>14/10/26</span></td></tr>
    <tr><td>14/10/26</td></tr><tr><td>32/99/26</td></tr>`),
    { "2026-10-14": 2 },
  );
});

test("CodeChef contest window uses official end dates and falls back to supplied minutes", () => {
  const contest = {
    contest_code: "START261",
    contest_name: "Starters 261",
    contest_start_date_iso: "2026-10-21T20:00:00+05:30",
    contest_end_date_iso: "2026-10-21T22:00:00+05:30",
    contest_duration: "120",
  };
  const data = parseContests({
    present_contests: [contest],
    future_contests: [{ ...contest, contest_end_date_iso: "invalid" }],
  });
  assert.equal(
    data[0].startTimeSeconds,
    Date.parse("2026-10-21T14:30:00Z") / 1000,
  );
  assert.equal(data[0].durationSeconds, 7200);
  assert.equal(data[1].durationSeconds, 7200);
  assert.equal(data[0].url, "https://www.codechef.com/START261");
  assert.throws(() => parseContests({ status: "blocked" }), /invalid contest/);
});

test("activity failures keep CodeChef profile data without fabricating a heatmap", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) =>
    url.includes("/recent/")
      ? new Response("Unavailable", { status: 503 })
      : new Response(html),
  );
  const profile = await getCodeChefProfile("example");
  assert.equal(profile.rating, 1825);
  assert.equal(profile.totalSolved, 102);
  assert.equal(profile.heatmap, null);
  assert.match(profile.warning, /activity unavailable/);
});

test("official contest end time wins over conflicting duration metadata", () => {
  const [contest] = parseContests({
    present_contests: [null],
    future_contests: [
      {
        contest_code: "START1",
        contest_name: "Starters",
        contest_start_date_iso: "2026-10-21T14:30:00Z",
        contest_end_date_iso: "2026-10-21T16:30:00Z",
        contest_duration: "9999",
      },
    ],
  });
  assert.equal(contest.durationSeconds, 7200);
});

test("malformed chart entries cannot hide valid CodeChef statistics", () => {
  const profile = parseProfile(
    html.replace(
      '[{"rating":"1825","end_date":"2026-10-14 22:00:00","name":"Starters 260"}]',
      '[null,{"rating":"2000","end_date":"2026-02-30"}]',
    ),
    "example",
  );
  assert.equal(profile.totalSolved, 102);
  assert.deepEqual(profile.ratingHistory, []);
  assert.equal(profile.attendedContests, null);
  assert.match(profile.warning, /history is incomplete/);
});
