import {
  getProfile,
  getSubmissionStats,
  validateHandle,
} from "./codeforces.js";
import { getLeetCodeProfile } from "./leetcode.js";
import { requestJson } from "./http.js";
import { platforms } from "../data/platforms.js";
import { normalizeProfile } from "../utils/profileValidation.js";
import {
  PROFILE_CACHE_MS,
  readSavedProfile,
  saveProfile,
} from "../utils/profileCache.js";

const cache = new Map();

export function validatePlatformHandle(handle, platform) {
  if (!Object.hasOwn(platforms, platform))
    return "Choose a supported platform.";
  if (typeof handle !== "string")
    return `Enter a ${platforms[platform].name} handle.`;
  if (platform === "codeforces") return validateHandle(handle);
  if (!handle.trim()) return `Enter a ${platforms[platform].name} handle.`;
  return /^[a-zA-Z0-9_.-]{2,30}$/.test(handle.trim())
    ? ""
    : "Use 2–30 letters, numbers, dots, underscores, or hyphens.";
}

async function fetchProfile(platform, handle, signal, force) {
  if (platform === "leetcode") return getLeetCodeProfile(handle, signal);
  if (platform === "codeforces") {
    const { user, ratings } = await getProfile(handle, signal, force);
    let submissions = { totalSolved: null, activity: null };
    let warning = "";
    try {
      submissions = await getSubmissionStats(handle, signal, force);
    } catch (error) {
      if (signal?.aborted) throw error;
      warning =
        "Solved counts and submission activity are unavailable. Rating details are still shown.";
    }
    if (submissions.solvedIsPartial)
      warning =
        "Solved counts and activity cover the latest 50,000 submissions; totals are a lower bound.";
    return {
      handle: user.handle,
      rank: user.rank || (user.rating == null ? "Unrated" : ""),
      rating: user.rating ?? null,
      ratingStatus: user.rating === undefined ? "unrated" : "available",
      maxRating: user.maxRating ?? null,
      attendedContests: ratings.length,
      ratingHistory: ratings.map((point) => ({
        date: new Date(point.ratingUpdateTimeSeconds * 1000)
          .toISOString()
          .slice(0, 10),
        rating: point.newRating,
        contest: point.contestName || "Codeforces Round",
      })),
      totalSolved: submissions.totalSolved,
      solvedIsPartial: Boolean(submissions.solvedIsPartial),
      heatmap: submissions.activity,
      warning,
      url: `${platforms[platform].profileUrl}${encodeURIComponent(user.handle)}`,
    };
  }
  const data = await requestJson(
    `/api/codechef/profile?handle=${encodeURIComponent(handle)}`,
    { signal },
    60000,
  );
  if (data.error) throw new Error(data.error);
  if (!data.handle || !Array.isArray(data.ratingHistory))
    throw new Error(
      "CodeChef returned incomplete profile data. Please try again.",
    );
  return data;
}

export async function getPlatformProfile(
  platform,
  handle,
  signal,
  force = false,
) {
  const validationError = validatePlatformHandle(handle, platform);
  if (validationError) throw new Error(validationError);
  if (signal?.aborted)
    throw new DOMException("Request cancelled.", "AbortError");
  handle = handle.trim();
  const key = `${platform}:${handle.toLowerCase()}`;
  const saved = cache.get(key) || readSavedProfile(platform, handle);
  const needsHistory =
    platform === "leetcode" &&
    saved?.profile.ratingStatus === "available" &&
    !saved.profile.ratingHistory.length;
  if (
    !force &&
    !needsHistory &&
    saved &&
    Date.now() - saved.time < PROFILE_CACHE_MS
  )
    return normalizeProfile(saved.profile, platform);
  const profile = normalizeProfile(
    await fetchProfile(platform, handle, signal, force),
    platform,
  );
  if (signal?.aborted)
    throw new DOMException("Request cancelled.", "AbortError");
  cache.set(key, saveProfile(platform, handle, profile));
  if (cache.size > 30) cache.delete(cache.keys().next().value);
  return profile;
}
