import test from "node:test";
import assert from "node:assert/strict";
import { countdown, formatDuration } from "../src/utils/format.js";
import { validateHandle } from "../src/services/codeforces.js";
import { readStorage, writeStorage } from "../src/utils/storage.js";

test("countdown never becomes negative after a contest starts", () => {
  assert.deepEqual(countdown(100, 200000), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    started: true,
  });
});

test("countdown separates days, hours, minutes, and seconds", () => {
  assert.deepEqual(countdown(93784, 0), {
    days: 1,
    hours: 2,
    minutes: 3,
    seconds: 4,
    started: false,
  });
  assert.equal(formatDuration(9000), "2h 30m");
});

test("invalid handles are caught before making a request", () => {
  assert.ok(validateHandle(""));
  assert.ok(validateHandle("abc;another-user"));
  assert.equal(validateHandle("  tourist  "), "");
});

test("corrupt or inaccessible browser storage is recoverable", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "{bad json",
      setItem: () => {
        throw new Error("Quota");
      },
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  });
  assert.equal(readStorage("key", "fallback"), "fallback");
  assert.equal(writeStorage("key", "value"), false);
});
test("countdown does not reach zero before the actual start", () => {
  assert.deepEqual(countdown(100, 99500), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 1,
    started: false,
  });
});
