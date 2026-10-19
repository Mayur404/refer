import { platforms } from "../data/platforms.js";

import { isCalendarDate } from "../../shared/dates.js";

// Both persisted snapshots and provider responses must be safe to render.
export function isValidProfile(profile) {
  const count = (value) =>
    value == null || (Number.isSafeInteger(value) && value >= 0);
  const rating = (value) =>
    value == null || (Number.isFinite(value) && value >= 0);
  return Boolean(
    profile &&
    !Array.isArray(profile) &&
    typeof profile.handle === "string" &&
    /^[a-zA-Z0-9_.-]{2,30}$/.test(profile.handle) &&
    rating(profile.rating) &&
    rating(profile.maxRating) &&
    [
      "totalSolved",
      "easySolved",
      "mediumSolved",
      "hardSolved",
      "attendedContests",
      "globalRanking",
    ].every((key) => count(profile[key])) &&
    ["rank", "stars", "warning"].every(
      (key) => profile[key] == null || typeof profile[key] === "string",
    ) &&
    (profile.ratingStatus === undefined ||
      ["available", "unavailable", "unrated"].includes(profile.ratingStatus)) &&
    Array.isArray(profile.ratingHistory) &&
    profile.ratingHistory.every(
      (point) =>
        point &&
        Number.isFinite(point.rating) &&
        point.rating >= 0 &&
        isCalendarDate(point.date) &&
        (point.contest == null || typeof point.contest === "string"),
    ) &&
    (profile.heatmap == null ||
      (typeof profile.heatmap === "object" &&
        !Array.isArray(profile.heatmap) &&
        Object.entries(profile.heatmap).every(
          ([date, value]) =>
            isCalendarDate(date) && Number.isSafeInteger(value) && value >= 0,
        ))),
  );
}

export function normalizeProfile(profile, platform) {
  if (!Object.hasOwn(platforms, platform) || !isValidProfile(profile)) {
    throw new Error(
      `${platforms[platform]?.name || "The service"} returned incomplete profile data. Please try again.`,
    );
  }
  return {
    ...profile,
    rating: profile.rating ?? null,
    totalSolved: profile.totalSolved ?? null,
    heatmap: profile.heatmap ?? null,
    ratingStatus:
      profile.ratingStatus ??
      (profile.rating != null ? "available" : "unavailable"),
    url: `${platforms[platform].profileUrl}${encodeURIComponent(profile.handle)}`,
  };
}
