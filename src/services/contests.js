import { getCodeforcesContests } from "./codeforces.js";
import { requestJson } from "./http.js";
import { getLeetCodeContests } from "./leetcode.js";
import { isOfficialContestUrl, platforms } from "../data/platforms.js";

const cache = new Map();

export function normalizeContest(item, platform, now = Date.now()) {
  if (
    !Object.hasOwn(platforms, platform) ||
    !item ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    !isOfficialContestUrl(item.url, platform)
  )
    return null;
  const start = item.startTimeSeconds;
  const duration = item.durationSeconds;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(new Date(start * 1000).getTime()) ||
    !Number.isFinite(new Date((start + duration) * 1000).getTime()) ||
    (start + duration) * 1000 <= now
  )
    return null;
  const slug = new URL(item.url).pathname.split("/").filter(Boolean).at(-1);
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return null;
  return {
    id: `${platform}-${slug}`,
    platform,
    name: item.name,
    url: item.url,
    startTimeSeconds: start,
    durationSeconds: duration,
    phase: start * 1000 <= now ? "CODING" : "BEFORE",
  };
}

async function fetchPlatform(platform, signal, force) {
  const saved = cache.get(platform);
  if (!force && saved && Date.now() - saved.time < 60000)
    return saved.contests.filter(
      (item) =>
        (item.startTimeSeconds + item.durationSeconds) * 1000 > Date.now(),
    );
  let items;
  if (platform === "codeforces") {
    items = (await getCodeforcesContests(signal, force)).map((item) => ({
      ...item,
      url: `https://codeforces.com/contest/${item.id}`,
    }));
  } else if (platform === "leetcode") {
    const contests = await getLeetCodeContests(signal);
    items = contests.map((item) => ({
      name: item.title,
      url: `https://leetcode.com/contest/${encodeURIComponent(item.titleSlug)}/`,
      startTimeSeconds: item.startTime,
      durationSeconds: item.duration,
    }));
  } else {
    const data = await requestJson("/api/codechef/contests", { signal });
    if (data.error) throw new Error(data.error);
    if (!Array.isArray(data))
      throw new Error("CodeChef returned an invalid contest list.");
    items = data;
  }
  const contests = items
    .map((item) => normalizeContest(item, platform))
    .filter(Boolean);
  if (
    items.length &&
    !contests.length &&
    items.some(
      (item) =>
        !item ||
        !Number.isFinite(item.startTimeSeconds) ||
        !Number.isFinite(item.durationSeconds) ||
        (item.startTimeSeconds + item.durationSeconds) * 1000 > Date.now(),
    )
  )
    throw new Error(
      "The service returned incomplete contest details. Please check the official schedule.",
    );
  cache.set(platform, { contests, time: Date.now() });
  return contests;
}

export async function getContests(signal, force = false) {
  const keys = Object.keys(platforms);
  const results = await Promise.allSettled(
    keys.map((platform) => fetchPlatform(platform, signal, force)),
  );
  if (signal?.aborted)
    throw new DOMException("Request cancelled.", "AbortError");
  const contests = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  return {
    contests: [
      ...new Map(contests.map((item) => [item.id, item])).values(),
    ].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
    sources: keys.map((platform, index) => ({
      platform,
      ok: results[index].status === "fulfilled",
      message:
        results[index].status === "rejected"
          ? results[index].reason.message
          : "",
    })),
  };
}
