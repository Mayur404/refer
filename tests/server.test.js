import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createAppServer } from "../server/start.js";
import { spawnSync } from "node:child_process";

test("production server handles malformed URLs, unknown APIs, methods and HEAD requests", async (t) => {
  const server = createAppServer({
    root: fileURLToPath(new URL("../public/", import.meta.url)),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const invalid = await fetch(`${base}/%ZZ`);
  assert.equal(invalid.status, 400);
  assert.equal((await fetch(`${base}/missing.txt`)).status, 404);
  const unknown = await fetch(`${base}/api/unknown`);
  assert.equal(unknown.status, 404);
  assert.match((await unknown.json()).error, /Unknown API/);
  const wrongMethod = await fetch(`${base}/favicon.svg`, { method: "POST" });
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "GET, HEAD");
  const get = await fetch(`${base}/favicon.svg`);
  assert.equal(get.status, 200);
  assert.equal(get.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    get.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(get.headers.get("cache-control"), "no-cache");
  assert.match(await get.text(), /<svg/);
  const head = await fetch(`${base}/favicon.svg`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(
    head.headers.get("content-type"),
    get.headers.get("content-type"),
  );
  const conflict = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../server/start.js", import.meta.url))],
    {
      env: {
        ...process.env,
        PORT: String(server.address().port),
        HOST: "127.0.0.1",
      },
      encoding: "utf8",
      timeout: 5000,
    },
  );
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /already in use/);
});

test("invalid production port fails with an actionable startup message", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../server/start.js", import.meta.url))],
    {
      env: { ...process.env, PORT: "invalid" },
      encoding: "utf8",
      timeout: 5000,
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PORT must be an integer/);
  assert.doesNotMatch(result.stderr, /ERR_SOCKET_BAD_PORT/);
});
