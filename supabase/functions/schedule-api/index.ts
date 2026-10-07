import { createScheduleFetchHandler } from "../../../server/schedule-fetch.mjs";
import { createSupabaseStore } from "../../../server/supabase-store.mjs";
import { createScheduleRateLimit } from "../../../server/schedule-rate-limit.mjs";

// Credentials stay inside Supabase. The browser only receives the function URL.
const modernKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const store = createSupabaseStore({
  url: Deno.env.get("SUPABASE_URL"),
  secretKey:
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    modernKeys.default ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
});
const allowedOrigins = (
  Deno.env.get("SCHEDULE_ALLOWED_ORIGINS") ||
  "https://calculator.medtechstack.com,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

Deno.serve(
  createScheduleFetchHandler({
    store,
    allowedOrigins,
    rateLimit: createScheduleRateLimit(store),
  })
);
