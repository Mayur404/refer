import { readStorage, writeStorage } from "./storage.js";
import { isValidProfile } from "./profileValidation.js";

export const PROFILE_CACHE_MS = 5 * 60 * 1000;

export function readSavedProfile(platform, handle) {
  const saved = readStorage(`cpsync.profile.${platform}`, null);
  if (
    saved?.version !== 1 ||
    saved.handle !== handle.toLowerCase() ||
    !Number.isFinite(saved.time) ||
    saved.time > Date.now() ||
    !isValidProfile(saved.profile) ||
    !(saved.profile.rating === null || Number.isFinite(saved.profile.rating)) ||
    saved.profile.totalSolved === undefined ||
    saved.profile.heatmap === undefined ||
    !["available", "unavailable", "unrated"].includes(
      saved.profile.ratingStatus,
    )
  )
    return null;
  return saved;
}

export function saveProfile(platform, handle, profile) {
  const entry = {
    version: 1,
    handle: handle.toLowerCase(),
    time: Date.now(),
    profile,
  };
  // One snapshot per platform keeps storage bounded, including submission calendars.
  writeStorage(`cpsync.profile.${platform}`, entry);
  return entry;
}
