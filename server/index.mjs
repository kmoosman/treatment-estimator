/* eslint-env node */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createScheduleMiddleware } from "./schedule-api.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

async function serveFrontend(request, response) {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Method not allowed.");
  }
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname
    );
  } catch {
    response.writeHead(400);
    return response.end("Invalid URL.");
  }
  let file = resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(404);
    return response.end("Not found.");
  }
  try {
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      if (extname(pathname) || pathname.startsWith("/api/")) {
        response.writeHead(404);
        return response.end("Not found.");
      }
      file = resolve(root, "index.html");
    }
    const infoToSend = await stat(file);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(file)] || "application/octet-stream",
      "Content-Length": infoToSend.size,
      "Cache-Control": pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") return response.end();
    const stream = createReadStream(file);
    stream.on("error", () => response.destroy());
    stream.pipe(response);
  } catch {
    response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(
      "The application has not been built. Run npm run build first."
    );
  }
}

const api = createScheduleMiddleware();
const server = createServer((request, response) =>
  api(request, response, () => serveFrontend(request, response))
);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
server.listen(port, host, () =>
  console.log(
    `Treatment Estimator is available at http://${host}:${
      server.address().port
    }`
  )
);
