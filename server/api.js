import { getCodeChefContests, getCodeChefProfile } from "./codechef.js";
import { getOfficialLeetCodeProfile } from "./leetcode.js";
import { aiApi } from "./ai.js";

const cache = new Map();

async function cached(key, lifetime, fetchData) {
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < lifetime) return saved.data;
  const data = await fetchData();
  cache.set(key, { data, time: Date.now() });
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return data;
}

export async function platformApi(req, res, next) {
  const send = (status, body) => {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    return send(400, { error: "Invalid request URL." });
  }
  if (url.pathname === "/api/ai/help") return aiApi(req, res);
  if (!url.pathname.startsWith("/api/")) return next();
  if (
    !url.pathname.startsWith("/api/codechef/") &&
    !url.pathname.startsWith("/api/leetcode/")
  )
    return send(404, { error: "Unknown API endpoint." });
  const provider = url.pathname.startsWith("/api/leetcode/")
    ? "LeetCode"
    : "CodeChef";
  if (req.method !== "GET") return send(405, { error: "Method not allowed." });
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    if (url.pathname === "/api/leetcode/profile") {
      const handle = url.searchParams.get("handle")?.trim() || "";
      if (!/^[a-zA-Z0-9_.-]{2,30}$/.test(handle))
        return send(400, { error: "Enter a valid LeetCode handle." });
      return send(
        200,
        await cached(`leetcode:${handle.toLowerCase()}`, 300000, () =>
          getOfficialLeetCodeProfile(handle, controller.signal),
        ),
      );
    }
    if (url.pathname === "/api/codechef/contests")
      return send(
        200,
        await cached("contests", 60000, () =>
          getCodeChefContests(controller.signal),
        ),
      );
    if (url.pathname === "/api/codechef/profile") {
      const handle = url.searchParams.get("handle")?.trim() || "";
      if (!/^[a-zA-Z0-9_.-]{2,30}$/.test(handle))
        return send(400, { error: "Enter a valid CodeChef handle." });
      return send(
        200,
        await cached(`profile:${handle.toLowerCase()}`, 300000, () =>
          getCodeChefProfile(handle, controller.signal),
        ),
      );
    }
    send(404, { error: "Unknown profile endpoint." });
  } catch (error) {
    send(error.status || 502, {
      error: [404, 429].includes(error.status)
        ? error.message
        : `${provider} is temporarily unavailable. Please try again.`,
    });
  }
}
