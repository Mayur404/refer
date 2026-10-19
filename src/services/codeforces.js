import { requestJson } from "./http.js";

const API = "https://codeforces.com/api/";
const cache = new Map();
let requestQueue = Promise.resolve();
let lastRequest = 0;

// Codeforces allows one call every two seconds. Queue requests across pages.
async function callApi(method, params = {}, signal, force = false) {
  if (signal?.aborted)
    throw new DOMException("Request cancelled.", "AbortError");
  const query = new URLSearchParams(params).toString();
  const key = `${method}?${query}`;
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.time < 60000) return cached.data;

  const task = requestQueue
    .catch(() => {})
    .then(async () => {
      if (signal?.aborted)
        throw new DOMException("Request cancelled.", "AbortError");
      const wait = Math.max(0, 2100 - (Date.now() - lastRequest));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      if (signal?.aborted)
        throw new DOMException("Request cancelled.", "AbortError");
      lastRequest = Date.now();
      const body = await requestJson(`${API}${key}`, { signal });
      if (body.status !== "OK" || !Array.isArray(body.result)) {
        throw new Error(
          body.comment ||
            "Codeforces returned unexpected data. Please try again.",
        );
      }
      cache.set(key, { data: body.result, time: Date.now() });
      if (cache.size > 100) cache.delete(cache.keys().next().value);
      return body.result;
    });
  requestQueue = task;
  return task;
}

export async function getCodeforcesContests(signal, force = false) {
  const contests = await callApi("contest.list", { gym: false }, signal, force);
  if (
    contests.some((contest) => !contest || typeof contest.phase !== "string")
  ) {
    throw new Error(
      "Codeforces returned an invalid contest list. Please try again.",
    );
  }
  return contests
    .filter((contest) => ["BEFORE", "CODING"].includes(contest.phase))
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}

export function validateHandle(value) {
  if (typeof value !== "string" || !value.trim())
    return "Enter a Codeforces handle.";
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(value.trim()))
    return "Use 3–24 letters, numbers, dots, underscores, or hyphens.";
  return "";
}

export async function getProfile(handle, signal, force = false) {
  const users = await callApi("user.info", { handles: handle }, signal, force);
  const user = users[0];
  if (!user || typeof user.handle !== "string")
    throw new Error("No profile found for this handle.");
  // Sequential calls intentionally respect the public API's request limit.
  const ratings = await callApi("user.rating", { handle }, signal, force);
  if (
    ratings.some(
      (point) =>
        !point ||
        !Number.isFinite(point.newRating) ||
        !Number.isFinite(point.ratingUpdateTimeSeconds) ||
        !Number.isFinite(
          new Date(point.ratingUpdateTimeSeconds * 1000).getTime(),
        ) ||
        (point.contestName != null && typeof point.contestName !== "string"),
    )
  ) {
    throw new Error(
      "Codeforces returned invalid rating history. Please try again.",
    );
  }
  return { user, ratings };
}

export async function getSubmissionStats(handle, signal, force = false) {
  const solved = new Set();
  const activity = {};
  const pageSize = 10000;
  for (let page = 0; page < 5; page++) {
    const submissions = await callApi(
      "user.status",
      { handle, from: page * pageSize + 1, count: pageSize },
      signal,
      force,
    );
    for (const submission of submissions) {
      if (!submission || typeof submission !== "object")
        throw new Error(
          "Codeforces returned invalid submissions. Please try again.",
        );
      if (Number.isFinite(submission.creationTimeSeconds)) {
        const timestamp = new Date(submission.creationTimeSeconds * 1000);
        if (!Number.isFinite(timestamp.getTime()))
          throw new Error("Codeforces returned an invalid submission date.");
        const date = timestamp.toISOString().slice(0, 10);
        activity[date] = (activity[date] || 0) + 1;
      }
      const problem = submission.problem;
      if (
        submission.verdict === "OK" &&
        problem?.index &&
        problem.contestId !== undefined
      )
        solved.add(`${problem.contestId}-${problem.index}`);
    }
    if (submissions.length < pageSize)
      return { totalSolved: solved.size, activity, solvedIsPartial: false };
  }
  return { totalSolved: solved.size, activity, solvedIsPartial: true };
}
