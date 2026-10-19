import test from "node:test";
import assert from "node:assert/strict";
import { runRemote } from "../src/services/compiler.js";

test("remote execution skips experimental and Python 2 runtimes", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("list.json"))
      return new Response(
        JSON.stringify([
          { name: "cpython-head", language: "Python" },
          { name: "cpython-2.7.18", language: "Python" },
          { name: "cpython-3.14.0", language: "Python" },
          { name: "gcc-head", language: "C++" },
          { name: "gcc-13.2.0", language: "C++" },
          { name: "openjdk-jdk-head", language: "Java" },
          { name: "openjdk-jdk-22+36", language: "Java" },
        ]),
      );
    requests.push(JSON.parse(options.body));
    return new Response(
      JSON.stringify({ status: "0", program_output: "20\n" }),
    );
  });
  assert.equal((await runRemote("python", "print(20)", "")).success, true);
  assert.equal((await runRemote("cpp", "int main() {}", "")).output, "20\n");
  assert.equal(requests[0].compiler, "cpython-3.14.0");
  assert.equal(requests[1].compiler, "gcc-13.2.0");
  assert.equal((await runRemote("java", "class Main {}", "")).success, true);
  assert.equal(requests[2].compiler, "openjdk-jdk-22+36");
  assert.equal(requests[0].save, false);
});

test("unsupported languages are rejected before calling the provider", async () => {
  await assert.rejects(
    runRemote("javascript", "console.log(1)", ""),
    /Choose Java, C\+\+, or Python/,
  );
});

test("remote compiler diagnostics are reported as a failed run", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          status: "1",
          compiler_error: "SyntaxError: invalid syntax",
        }),
      ),
  );
  const result = await runRemote("python", "bad code", "");
  assert.equal(result.success, false);
  assert.match(result.output, /SyntaxError/);
});

test("invalid compiler payloads cannot appear as successful execution", async (t) => {
  for (const result of [
    null,
    [],
    {},
    { status: {} },
    { status: "0", program_output: {} },
    { signal: 9 },
  ]) {
    t.mock.method(globalThis, "fetch", async () => Response.json(result));
    await assert.rejects(
      runRemote("python", "print(1)", ""),
      /incomplete result|unreadable response/,
    );
  }
});

test("runtime termination and nonzero exit status explain failed execution", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ status: "137", signal: "SIGKILL" }),
  );
  const result = await runRemote("python", "while True: pass", "");
  assert.equal(result.success, false);
  assert.match(result.output, /SIGKILL/);
  assert.match(result.output, /137/);
});

test("compiler input validation runs before any network request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({}),
  );
  for (const args of [
    ["constructor", "code", ""],
    ["python", " ", ""],
    ["python", "x".repeat(50001), ""],
    ["python", "code", "x".repeat(10001)],
  ]) {
    await assert.rejects(runRemote(...args));
  }
  assert.equal(fetch.mock.callCount(), 0);
});
test("invalid runtime discovery can recover on the next attempt", async (t) => {
  const { runRemote: run } =
    await import("../src/services/compiler.js?runtime-recovery");
  let healthy = false;
  t.mock.method(globalThis, "fetch", async (url) =>
    Response.json(
      url.endsWith("list.json")
        ? healthy
          ? [{ name: "cpython-3.14.0", language: "Python" }]
          : [null, {}]
        : { status: "0", program_output: "recovered" },
    ),
  );
  await assert.rejects(run("python", "print(1)", ""), /invalid language list/);
  healthy = true;
  assert.equal((await run("python", "print(1)", "")).output, "recovered");
});

test("large program output is explicitly marked as truncated", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ status: "0", program_output: "x".repeat(40000) }),
  );
  const result = await runRemote("python", "print(1)", "");
  assert.equal(result.output.length, 30000);
  assert.match(result.output, /Output truncated/);
});
