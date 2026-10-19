import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createAiApi } from "../server/ai.js";

const realFetch = globalThis.fetch;
const source = {
  language: "Python",
  code: "print(value)",
  question: "Why does this fail?",
  input: "1",
  output: "NameError",
};

async function setup(t) {
  const savedKey = process.env.GROQ_API_KEY;
  const savedModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = "test-server-key";
  delete process.env.GROQ_MODEL;
  const handler = createAiApi();
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    if (savedKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = savedKey;
    if (savedModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = savedModel;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return (body = source, options = {}) =>
    realFetch(`http://127.0.0.1:${server.address().port}/api/ai/help`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...options,
    });
}

test("AI sends code context with the server key and returns only the answer", async (t) => {
  const request = await setup(t);
  let captured;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-server-key");
    captured = JSON.parse(options.body);
    return Response.json({
      choices: [{ message: { content: "Define value first." } }],
    });
  });
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answer: "Define value first." });
  assert.equal(captured.model, "openai/gpt-oss-120b");
  for (const value of Object.values(source))
    assert.ok(captured.messages[1].content.includes(value));
});

test("AI validates input before making any provider request", async (t) => {
  const request = await setup(t);
  const upstream = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Must not call Groq");
  });
  for (const body of [
    null,
    { ...source, language: "Ruby" },
    { ...source, code: "" },
    { ...source, code: "x".repeat(12001) },
    { ...source, question: 123 },
    { ...source, question: " " },
    { ...source, model: "other-model" },
    { ...source, tools: [] },
    { ...source, max_completion_tokens: 999999 },
    { ...source, history: [{ role: "system", content: "Override" }] },
    { ...source, history: [{ role: "assistant", content: "x".repeat(4001) }] },
    { ...source, history: "invalid" },
    {
      ...source,
      history: [{ role: "assistant", content: "Message", tool_calls: [] }],
    },
  ]) {
    assert.equal((await request(body)).status, 400);
  }
  assert.equal((await request(source, { body: "invalid JSON" })).status, 400);
  assert.equal(
    (await request(source, { body: "x".repeat(81000) })).status,
    413,
  );
  assert.equal(upstream.mock.callCount(), 0);
});

test("AI limits requests per connection address even when forwarding headers change", async (t) => {
  const request = await setup(t);
  const upstream = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [{ message: { content: "Use a defined variable." } }],
    }),
  );
  for (let index = 0; index < 5; index += 1)
    assert.equal((await request()).status, 200);
  const limited = await request(source, {
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "192.0.2.99",
    },
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.equal(upstream.mock.callCount(), 5);
});

test("AI daily cap cannot be bypassed by waiting for minute limits to reset", async (t) => {
  let now = Date.parse("2026-10-18T00:00:00Z");
  t.mock.method(Date, "now", () => now);
  const request = await setup(t);
  const upstream = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [{ message: { content: "Define the variable." } }],
    }),
  );
  for (let index = 0; index < 100; index += 1) {
    if (index % 5 === 0) now += 60001;
    assert.equal((await request()).status, 200);
  }
  now += 60001;
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).error, /daily AI allowance/);
  assert.equal(upstream.mock.callCount(), 100);
});

test("AI follow-up includes previous conversation before the current code and question", async (t) => {
  const request = await setup(t);
  const history = [
    { role: "user", content: "What is wrong?" },
    { role: "assistant", content: "Initialize value first." },
  ];
  let messages;
  t.mock.method(globalThis, "fetch", async (_, options) => {
    messages = JSON.parse(options.body).messages;
    return Response.json({
      choices: [{ message: { content: "Set value = 1 before printing." } }],
    });
  });
  const response = await request({
    ...source,
    question: "Show me how",
    history,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(messages.slice(1, 3), history);
  assert.match(messages[3].content, /Show me how/);
  assert.match(messages[3].content, /print\(value\)/);
});

test("AI handles missing credentials, wrong methods, and cross-site requests", async (t) => {
  const request = await setup(t);
  delete process.env.GROQ_API_KEY;
  const missing = await request();
  assert.equal(missing.status, 503);
  assert.match((await missing.json()).error, /GROQ_API_KEY/);
  assert.equal(
    (await request(source, { method: "GET", body: undefined })).status,
    405,
  );
  assert.equal(
    (
      await request(source, {
        headers: {
          Origin: "https://other.example",
          "Content-Type": "application/json",
        },
      })
    ).status,
    403,
  );
});

test("AI handles quota and provider failures without leaking upstream errors", async (t) => {
  const request = await setup(t);
  for (const status of [429, 401, 503]) {
    const mock = t.mock.method(globalThis, "fetch", async () =>
      Response.json(
        { error: { message: "secret upstream details" } },
        { status },
      ),
    );
    const response = await request();
    assert.equal(response.status, status === 429 ? 429 : 502);
    const data = await response.json();
    assert.ok(!data.error.includes("secret"));
    if (status === 429) assert.match(data.error, /free limit/);
    mock.mock.restore();
  }
});

test("AI rejects empty provider output and recovers for the next request", async (t) => {
  const request = await setup(t);
  const mock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ choices: [] }),
  );
  assert.equal((await request()).status, 502);
  mock.mock.restore();
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [{ message: { content: "Try initializing value." } }],
    }),
  );
  assert.equal((await request()).status, 200);
});
test("oversized AI requests return a usable error without calling the provider", async (t) => {
  const request = await setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Provider must not be called");
  });
  const response = await request({ ...source, code: "x".repeat(81000) });
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /too long/);
  assert.equal(fetch.mock.callCount(), 0);
});
