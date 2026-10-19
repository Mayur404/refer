import test from "node:test";
import assert from "node:assert/strict";

test("forced profile and submission refresh bypass all Codeforces caches", async (t) => {
  const { getProfile, getSubmissionStats } =
    await import("../src/services/codeforces.js?refresh-test");
  let time = Date.now();
  t.mock.method(Date, "now", () => (time += 2200));
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    requests.push(url);
    return Response.json({
      status: "OK",
      result: url.includes("user.info") ? [{ handle: "tester" }] : [],
    });
  });
  await getProfile("tester");
  await getSubmissionStats("tester");
  assert.equal(requests.length, 3);
  await getProfile("tester");
  await getSubmissionStats("tester");
  assert.equal(requests.length, 3);
  await getProfile("tester", undefined, true);
  await getSubmissionStats("tester", undefined, true);
  assert.equal(requests.length, 6);
});

test("invalid Codeforces rating dates fail with an actionable error", async (t) => {
  const { getProfile } =
    await import("../src/services/codeforces.js?invalid-rating");
  let time = Date.now();
  t.mock.method(Date, "now", () => (time += 2200));
  t.mock.method(globalThis, "fetch", async (url) =>
    Response.json({
      status: "OK",
      result: url.includes("user.info")
        ? [{ handle: "tester" }]
        : [{ newRating: 1500, ratingUpdateTimeSeconds: 1e20 }],
    }),
  );
  await assert.rejects(getProfile("tester"), /invalid rating history/);
});
