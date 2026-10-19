import test from "node:test";
import assert from "node:assert/strict";
import { requestJson } from "../src/services/http.js";

test("returns JSON from a successful API response", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ status: "OK", result: [1] })),
  );
  assert.deepEqual(await requestJson("https://example.test"), {
    status: "OK",
    result: [1],
  });
});

test("rate limiting has an actionable error", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("", { status: 429 }),
  );
  await assert.rejects(
    requestJson("https://example.test"),
    /Too many requests/,
  );
});

test("rejects unreadable success responses rather than displaying fake data", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>service down</html>"),
  );
  await assert.rejects(
    requestJson("https://example.test"),
    /unreadable response/,
  );
});

test("network failures produce a useful message", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    requestJson("https://example.test"),
    /Could not reach the service/,
  );
});

test("timeout aborts the request", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    (_, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  await assert.rejects(
    requestJson("https://example.test", {}, 10),
    /took too long/,
  );
});

test("navigation cancellation remains distinct from timeouts", async (t) => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Aborted", "AbortError");
  });
  await assert.rejects(
    requestJson("https://example.test", { signal: controller.signal }),
    { name: "AbortError" },
  );
});

test("null and primitive JSON payloads are rejected at the HTTP boundary", async (t) => {
  for (const value of [null, true, 7, "unexpected"]) {
    t.mock.method(globalThis, "fetch", async () => Response.json(value));
    await assert.rejects(
      requestJson("https://example.test"),
      /unreadable response/,
    );
  }
});

test("already-cancelled requests do not call fetch", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({}),
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    requestJson("https://example.test", { signal: controller.signal }),
    { name: "AbortError" },
  );
  assert.equal(fetch.mock.callCount(), 0);
});
