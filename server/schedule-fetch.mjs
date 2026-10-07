/* eslint-env node */
import {
  ApiError,
  BODY_LIMIT,
  createScheduleService,
  validateBody,
} from "./schedule-service.mjs";
import { ScheduleStoreError } from "./supabase-store.mjs";

async function readBody(request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new ApiError(415, "Send request data as JSON.");
  if (Number(request.headers.get("content-length")) > BODY_LIMIT)
    throw new ApiError(413, "This request is too large.");
  const reader = request.body?.getReader();
  let size = 0;
  const chunks = [];
  if (reader) {
    try {
      for (
        let chunk = await reader.read();
        !chunk.done;
        chunk = await reader.read()
      ) {
        const { value } = chunk;
        size += value.byteLength;
        if (size > BODY_LIMIT) {
          await reader.cancel();
          throw new ApiError(413, "This request is too large.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "Request data must be valid JSON.");
  }
  return validateBody(body);
}

export function createScheduleFetchHandler({
  store,
  basePath = "/schedule-api",
  allowedOrigins = [],
  rateLimit,
} = {}) {
  const service = createScheduleService(store);
  const origins = new Set(allowedOrigins);
  return async (request) => {
    const origin = request.headers.get("origin");
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    };
    // CORS limits browser callers; event links and edit tokens determine access.
    if (origin && origins.has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Headers"] = "authorization, content-type";
      headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS";
      headers["Access-Control-Max-Age"] = "3600";
    }
    const respond = (status, body) =>
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers,
      });
    if (origin && !origins.has(origin))
      return respond(403, {
        error: "This website is not allowed to use the scheduling service.",
      });
    try {
      let pathname = new URL(request.url).pathname;
      if (pathname.startsWith("/functions/v1/"))
        pathname = pathname.slice("/functions/v1".length);
      if (!pathname.startsWith(`${basePath}/`))
        throw new ApiError(404, "API route not found.");
      if (request.method === "OPTIONS") return respond(204);
      const localPath = pathname.slice(basePath.length);
      if (rateLimit) await rateLimit({ request, pathname: localPath });
      const result = await service({
        method: request.method,
        pathname: localPath,
        authorization: request.headers.get("authorization") || "",
        readBody: () => readBody(request),
      });
      return respond(result.status, result.body);
    } catch (error) {
      const known =
        error instanceof ApiError || error instanceof ScheduleStoreError;
      return respond(known ? error.status : 500, {
        error: known
          ? error.message
          : "The schedule could not be saved or loaded. Please try again.",
      });
    }
  };
}
