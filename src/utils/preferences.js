import { platforms } from "../data/platforms.js";

export const isPlatformList = (value) =>
  Array.isArray(value) && value.every((item) => Object.hasOwn(platforms, item));
export const isActivityPlatform = (value) =>
  value === "combined" || Object.hasOwn(platforms, value);
export const isContestPhase = (value) =>
  ["all", "upcoming", "live"].includes(value);
export const isSearchQuery = (value) =>
  typeof value === "string" && value.length <= 200;
