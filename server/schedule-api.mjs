/* eslint-env node */
import { resolve } from "node:path";
import {
  ApiError,
  BODY_LIMIT,
  createScheduleService,
} from "./schedule-service.mjs";
import { createFileStore } from "./file-store.mjs";
import { createSupabaseStore, ScheduleStoreError } from "./supabase-store.mjs";
async function readBody(request) {
  if (
    request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    request.resume();
    throw new ApiError(415, "Send request data as JSON.");
  }
  const buffer = await new Promise((resolveBody, reject) => {
    let size = 0;
    let oversized = false;
    const chunks = [];
    request.on("data", (chunk) => {
      if (oversized) return;
      size += chunk.length;
      if (size > BODY_LIMIT) {
        oversized = true;
        chunks.length = 0;
        reject(new ApiError(413, "This request is too large."));
        return;
      }
      chunks.push(chunk);
    });
    request.once("end", () => resolveBody(Buffer.concat(chunks)));
    request.once("error", reject);
    request.once("aborted", () =>
      reject(new ApiError(400, "The request was interrupted."))
    );
  });
  let body;
  try {
    body = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new ApiError(400, "Request data must be valid JSON.");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body))
    throw new ApiError(400, "Request data must be an object.");
  return body;
}

function respond(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

export function createScheduleMiddleware({ dataDir, store } = {}) {
  const configuredStore =
    store ||
    (dataDir || !process.env.SUPABASE_URL
      ? createFileStore(
          dataDir ||
            process.env.SCHEDULE_DATA_DIR ||
            resolve(process.cwd(), ".schedule-data")
        )
      : createSupabaseStore());
  const service = createScheduleService(configuredStore);
  return async (request, response, next) => {
    let pathname;
    try {
      pathname = new URL(request.url, "http://localhost").pathname;
    } catch {
      return respond(response, 400, { error: "Invalid request URL." });
    }
    if (!pathname.startsWith("/api/schedule/") && pathname !== "/api/schedule")
      return next();
    try {
      const result = await service({
        method: request.method,
        pathname: pathname.slice("/api/schedule".length),
        authorization: request.headers.authorization || "",
        readBody: () => readBody(request),
      });
      return respond(response, result.status, result.body);
    } catch (error) {
      const known =
        error instanceof ApiError || error instanceof ScheduleStoreError;
      respond(response, known ? error.status : 500, {
        error: known
          ? error.message
          : "The schedule could not be saved or loaded. Please try again.",
      });
    }
  };
}
export function scheduleApiPlugin(options = {}) {
  return {
    name: "schedule-api",
    configureServer(server) {
      server.middlewares.use(createScheduleMiddleware(options));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createScheduleMiddleware(options));
    },
  };
}
