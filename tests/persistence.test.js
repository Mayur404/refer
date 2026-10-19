import test from "node:test";
import assert from "node:assert/strict";
import { readSavedProfile, saveProfile } from "../src/utils/profileCache.js";
import {
  isActivityPlatform,
  isPlatformList,
  isContestPhase,
} from "../src/utils/preferences.js";

test("profile snapshots survive module reloads and are tied to the submitted handle", async (t) => {
  const items = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => items.set(key, value),
    },
    configurable: true,
  });
  t.after(() => delete globalThis.localStorage);
  const profile = {
    handle: "tester",
    totalSolved: 120,
    rating: 1800,
    ratingStatus: "available",
    ratingHistory: [],
    heatmap: {},
  };
  saveProfile("leetcode", "tester", profile);
  const reloaded = await import("../src/utils/profileCache.js?reload");
  assert.deepEqual(
    reloaded.readSavedProfile("leetcode", "TESTER").profile,
    profile,
  );
  assert.equal(readSavedProfile("leetcode", "different"), null);
  items.set("cpsync.profile.leetcode", "invalid-json");
  assert.equal(readSavedProfile("leetcode", "tester"), null);
  items.set("cpsync.profile.leetcode", JSON.stringify({ version: 0, profile }));
  assert.equal(readSavedProfile("leetcode", "tester"), null);
});

test("unavailable browser storage does not prevent fetching or returning a profile", (t) => {
  Object.defineProperty(globalThis, "localStorage", {
    get() {
      throw new Error("Storage blocked");
    },
    configurable: true,
  });
  t.after(() => delete globalThis.localStorage);
  assert.equal(readSavedProfile("leetcode", "tester"), null);
  assert.equal(
    saveProfile("leetcode", "tester", { handle: "tester" }).profile.handle,
    "tester",
  );
});

test("stored filter values reject unknown platforms and invalid shapes", () => {
  assert.equal(isPlatformList(["leetcode", "codeforces"]), true);
  assert.equal(isPlatformList(["unknown"]), false);
  assert.equal(isPlatformList(null), false);
  assert.equal(isActivityPlatform("combined"), true);
  assert.equal(isActivityPlatform("toString"), false);
  assert.equal(isContestPhase("upcoming"), true);
  assert.equal(isContestPhase("expired"), false);
});

test("corrupt optional snapshot fields cannot crash profile rendering", (t) => {
  const profile = {
    handle: "tester",
    rating: 1000,
    totalSolved: 2,
    ratingStatus: "available",
    ratingHistory: [],
    heatmap: null,
  };
  let saved;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(saved) },
  });
  t.after(() => delete globalThis.localStorage);
  for (const corrupt of [
    { rank: {} },
    { warning: [] },
    { easySolved: -1 },
    { heatmap: { "2026-02-30": 1 } },
    { ratingHistory: [{ date: "2026-01-01", rating: 1000, contest: {} }] },
  ]) {
    saved = {
      version: 1,
      handle: "tester",
      time: Date.now(),
      profile: { ...profile, ...corrupt },
    };
    assert.equal(readSavedProfile("leetcode", "tester"), null);
  }
});
