import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 5173);
const allowedRoots = new Set(["index.html", "config.js", "src"]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    if (!["GET", "HEAD"].includes(method)) {
      res.writeHead(405, { allow: "GET, HEAD" });
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    let pathname = decodeURIComponent(url.pathname);
    pathname = pathname.replace(/^\/chatgpt(?=\/|$)/, "") || "/";
    const relative = pathname === "/" ? "index.html" : normalize(pathname.replace(/^\/+/, ""));
    const first = relative.split(/[\\/]/)[0];

    if (!allowedRoots.has(first)) {
      res.writeHead(404, { "cache-control": "no-store" });
      res.end("Not found");
      return;
    }

    const filePath = resolve(join(root, relative));
    if (!filePath.startsWith(root)) {
      res.writeHead(403, { "cache-control": "no-store" });
      res.end("Forbidden");
      return;
    }

    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");

    res.writeHead(200, {
      "content-type": types[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(await readFile(filePath));
  } catch (_) {
    res.writeHead(404, { "cache-control": "no-store" });
    res.end("Not found");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`AstranoV ChatGPT lab running at http://localhost:${port}/chatgpt/`);
});
