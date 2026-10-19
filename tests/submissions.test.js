import test from "node:test";
import assert from "node:assert/strict";
import { getSubmissionStats } from "../src/services/codeforces.js";

test("solved totals deduplicate accepted problems while activity counts all attempts", async (t) => {
  const creationTimeSeconds = Date.parse("2026-10-16T12:00:00Z") / 1000;
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          result: [
            {
              creationTimeSeconds,
              verdict: "OK",
              problem: { contestId: 123, index: "A" },
            },
            {
              creationTimeSeconds,
              verdict: "OK",
              problem: { contestId: 123, index: "A" },
            },
            {
              creationTimeSeconds,
              verdict: "WRONG_ANSWER",
              problem: { contestId: 123, index: "B" },
            },
            {
              creationTimeSeconds,
              verdict: "OK",
              problem: { contestId: 124, index: "A" },
            },
          ],
        }),
      ),
  );
  const result = await getSubmissionStats("tester");
  assert.equal(result.totalSolved, 2);
  assert.equal(result.solvedIsPartial, false);
  assert.deepEqual(result.activity, { "2026-10-16": 4 });
});
