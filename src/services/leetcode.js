import { requestJson } from "./http.js";
import { normalizeActivity } from "../utils/activity.js";
import { readStorage, writeStorage } from "../utils/storage.js";

const ALFA = "https://alfa-leetcode-api.onrender.com/";
const storedLimit = readStorage("cpsync.leetcode.retryAfter", 0);
let rateLimitedUntil =
  Number.isFinite(storedLimit) && storedLimit <= Date.now() + 3600000
    ? storedLimit
    : 0;

async function requestAlfa(path, signal) {
  if (Date.now() < rateLimitedUntil)
    throw new Error("The LeetCode provider is temporarily rate limited.");
  try {
    return await requestJson(`${ALFA}${path}`, { signal });
  } catch (error) {
    // The live provider returns HTTP 429 with a one-hour IP limit.
    if (error.status === 429) {
      rateLimitedUntil = Date.now() + 60 * 60 * 1000;
      writeStorage("cpsync.leetcode.retryAfter", rateLimitedUntil);
    }
    throw error;
  }
}

function checkUserResponse(data) {
  if (
    /does not exist|not found|no user/i.test(data?.error || "") ||
    (Array.isArray(data?.errors) &&
      data.errors.some((error) =>
        /does not exist|not found/i.test(error?.message),
      ))
  ) {
    const error = new Error("LeetCode user not found. Check the handle.");
    error.notFound = true;
    throw error;
  }
}

function checkSolvedResponse(data) {
  checkUserResponse(data);
  if (!Number.isInteger(data?.totalSolved) || data.totalSolved < 0)
    throw new Error("LeetCode returned incomplete profile data.");
  return data;
}

export async function getLeetCodeContests(signal) {
  try {
    const data = await requestAlfa("contests/upcoming", signal);
    if (
      !Array.isArray(data.contests) ||
      data.contests.some(
        (item) =>
          typeof item?.titleSlug !== "string" ||
          !/^[a-zA-Z0-9_-]+$/.test(item.titleSlug),
      )
    )
      throw new Error("Incomplete contest response.");
    return data.contests;
  } catch (error) {
    if (signal?.aborted) throw error;
    const response = await requestJson(
      "https://competeapi.vercel.app/contests/leetcode/",
      { signal },
    );
    const contests = response.data?.topTwoContests;
    if (!Array.isArray(contests))
      throw new Error("LeetCode contest feeds are unavailable.");
    return contests.map((item) => {
      const match =
        typeof item?.title === "string"
          ? item.title.match(/^(Weekly|Biweekly) Contest (\d+)$/i)
          : null;
      if (!match)
        throw new Error("LeetCode returned an unrecognized contest link.");
      return {
        ...item,
        titleSlug: `${match[1].toLowerCase()}-contest-${match[2]}`,
      };
    });
  }
}

export function normalizeLeetCodeRanking(data) {
  data = data?.data || data;
  const official = Object.hasOwn(data || {}, "userContestRanking");
  const ranking = official ? data.userContestRanking : null;
  const rawHistory = official
    ? data.userContestRankingHistory
    : data?.contestParticipation;
  const history = Array.isArray(rawHistory) ? rawHistory : [];
  const points = history
    .filter(
      (item) =>
        item &&
        (official ? item.attended === true : item.attended !== false) &&
        Number.isFinite(item.rating) &&
        Number.isFinite(item.contest?.startTime) &&
        Number.isFinite(new Date(item.contest.startTime * 1000).getTime()),
    )
    .sort((a, b) => a.contest.startTime - b.contest.startTime)
    .map((item) => ({
      date: new Date(item.contest.startTime * 1000).toISOString().slice(0, 10),
      rating: Math.round(item.rating),
      contest:
        typeof item.contest.title === "string"
          ? item.contest.title
          : "LeetCode Contest",
    }));
  const rawRating = official ? ranking?.rating : data?.contestRating;
  const rating = Number.isFinite(rawRating) ? Math.round(rawRating) : null;
  const rawCount = official
    ? (ranking?.attendedContestsCount ?? (ranking === null ? 0 : null))
    : data?.contestAttend;
  const count = Number.isInteger(rawCount) ? rawCount : null;
  return {
    rating,
    ratingStatus:
      rating !== null ? "available" : count === 0 ? "unrated" : "unavailable",
    attendedContests: count,
    globalRanking:
      (official ? ranking?.globalRanking : data?.contestGlobalRanking) ?? null,
    ratingHistory: points,
  };
}

export function normalizeOfficialLeetCodeProfile(response, handle) {
  checkUserResponse(response);
  const data = response.data;
  const user = data?.matchedUser;
  const stats = user?.submitStatsGlobal?.acSubmissionNum;
  if (!Array.isArray(stats))
    throw new Error("Incomplete official profile response.");
  const count = (difficulty) => {
    const value = stats.find((item) => item?.difficulty === difficulty)?.count;
    return Number.isInteger(value) && value >= 0 ? value : null;
  };
  const totalSolved = count("All");
  if (totalSolved === null)
    throw new Error("Incomplete official solved count.");
  const ranking = normalizeLeetCodeRanking(data);
  return {
    handle: user.username || handle,
    totalSolved,
    easySolved: count("Easy"),
    mediumSolved: count("Medium"),
    hardSolved: count("Hard"),
    heatmap: normalizeActivity(user.userCalendar?.submissionCalendar),
    ...ranking,
    maxRating: ranking.ratingHistory.length
      ? Math.max(...ranking.ratingHistory.map((point) => point.rating))
      : null,
    warning:
      ranking.ratingStatus === "unavailable"
        ? "Contest ratings are unavailable. Solved counts are still shown."
        : ranking.attendedContests > 0 && !ranking.ratingHistory.length
          ? "Contest rating history is temporarily unavailable."
          : "",
    url: `https://leetcode.com/u/${encodeURIComponent(user.username || handle)}`,
  };
}

export async function getLeetCodeProfile(handle, signal) {
  try {
    const response = await requestJson(
      `/api/leetcode/profile?handle=${encodeURIComponent(handle)}`,
      { signal },
    );
    return normalizeOfficialLeetCodeProfile(response, handle);
  } catch (error) {
    if (signal?.aborted || error.notFound || error.status === 404) throw error;
  }
  const username = encodeURIComponent(handle);
  const warnings = [];
  let data;
  try {
    data = checkSolvedResponse(
      await requestAlfa(`${username}/profile`, signal),
    );
  } catch (error) {
    if (signal?.aborted || error.notFound) throw error;
    data = checkSolvedResponse(
      await requestJson(
        `https://leetcode-api-faisalshohag.vercel.app/${username}`,
        { signal },
      ),
    );
    warnings.push(
      "Using a secondary public LeetCode feed while the primary feed is unavailable.",
    );
  }

  let ranking;
  try {
    const response = await requestAlfa(`${username}/contest`, signal);
    ranking = normalizeLeetCodeRanking(response);
    if (ranking.ratingStatus === "unavailable")
      throw new Error("Incomplete ranking response.");
  } catch (error) {
    if (signal?.aborted) throw error;
    try {
      const response = await requestJson(
        `https://competeapi.vercel.app/user/leetcode/${username}/`,
        { signal },
      );
      if (
        !response.data?.matchedUser ||
        !Object.hasOwn(response.data, "userContestRanking")
      )
        throw new Error("Contest ranking is unavailable.");
      ranking = normalizeLeetCodeRanking(response);
      if (!ranking.ratingHistory.length && ranking.ratingStatus !== "unrated")
        warnings.push(
          "Detailed rating history is unavailable from the secondary feed.",
        );
    } catch (fallbackError) {
      if (signal?.aborted) throw fallbackError;
      ranking = {
        rating: null,
        ratingStatus: "unavailable",
        attendedContests: null,
        globalRanking: null,
        ratingHistory: [],
      };
      warnings.push(
        "Contest ratings are unavailable. Solved counts are still shown.",
      );
    }
  }
  return {
    handle,
    totalSolved: data.totalSolved,
    easySolved: data.easySolved ?? null,
    mediumSolved: data.mediumSolved ?? null,
    hardSolved: data.hardSolved ?? null,
    heatmap: normalizeActivity(data.submissionCalendar),
    ...ranking,
    maxRating: ranking.ratingHistory.length
      ? Math.max(...ranking.ratingHistory.map((point) => point.rating))
      : null,
    warning: warnings.join(" "),
    url: `https://leetcode.com/u/${username}`,
  };
}
