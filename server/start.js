import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, sep, extname } from "node:path";
import { platformApi } from "./api.js";

const defaultRoot = fileURLToPath(new URL("../dist/", import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
export function createAppServer({ root = defaultRoot } = {}) {
  return createServer((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    const handle = async () =>
      platformApi(req, res, async () => {
        if (!["GET", "HEAD"].includes(req.method)) {
          res.writeHead(405, { Allow: "GET, HEAD" });
          res.end("Method not allowed");
          return;
        }
        try {
          const pathname = decodeURIComponent(
            new URL(req.url, "http://localhost").pathname,
          );
          if (pathname.includes("\0")) throw new URIError("Invalid path");
          const file = resolve(
            root,
            `.${pathname === "/" ? "/index.html" : pathname}`,
          );
          if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
            res.writeHead(403);
            res.end();
            return;
          }
          const body = await readFile(file);
          res.writeHead(200, {
            "Content-Type": types[extname(file)] || "application/octet-stream",
            "Cache-Control": "no-cache",
          });
          res.end(req.method === "HEAD" ? undefined : body);
        } catch (error) {
          if (res.destroyed || res.writableEnded) return;
          const status =
            error instanceof URIError
              ? 400
              : ["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)
                ? 404
                : 500;
          res.writeHead(status);
          res.end(
            status === 400
              ? "Invalid request URL"
              : status === 404
                ? "Not found"
                : "Unable to serve this file. Please try again.",
          );
        }
      });
    void handle().catch(() => {
      if (res.destroyed || res.writableEnded) return;
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(500, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          error:
            "The server could not complete this request. Please try again.",
        }),
      );
    });
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error("PORT must be an integer between 0 and 65535.");
    process.exitCode = 1;
  } else {
    const server = createAppServer();
    server.on("error", (error) => {
      console.error(
        error.code === "EADDRINUSE"
          ? `Port ${port} is already in use. Choose another PORT.`
          : "Unable to start CPSync. Check HOST and PORT.",
      );
      process.exitCode = 1;
    });
    server.listen(port, process.env.HOST || "127.0.0.1", () =>
      console.log(`CPSync running on port ${server.address().port}`),
    );
  }
}
