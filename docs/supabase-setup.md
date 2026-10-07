# Supabase setup for shared schedules

The **OncoLogic Schedule** project is in the **OncoLogic** organization, with
project reference **`skjooqzogckjlchtayvj`**. Setup status as of October 6, 2026:

- All three SQL migrations were applied successfully through the dashboard. Their CLI
  migration-history entries have not yet been recorded.
- Six local events with nine participant responses were imported, preserving event
  and participant IDs and edit-token hashes.
- The database security advisor reports zero errors, zero warnings, and two
  informational "RLS Enabled No Policy" notices for the intentionally server-only
  tables. The automatic-RLS helper's public execution privileges were removed;
  its owner and event trigger were preserved.
- The `schedule-api` function was deployed through the dashboard. Its gateway's
  legacy JWT check was disabled with owner approval, and the saved setting was
  verified. A public missing-event read now reaches the application handler and
  returns `404`.
- The local `.env.local` URL is active, Vite was restarted, and the local app now
  uses Supabase. Before switching, the six local events and nine responses were
  rechecked against the imported snapshot and remained unchanged.
- All 24 live API checks passed, covering save, reload, edit, CORS, and `403`
  responses for missing or invalid edit tokens. Migrated schedules loaded in the
  browser, and a synthetic participant saved in the in-app browser appeared in a
  separate Chrome browser. Name-based recovery and a subsequent edit in Chrome
  succeeded; reloading the original browser showed the updated saved times.
  One labeled synthetic event with test participant
  responses was added for validation; the original six events and nine responses
  were preserved.
- The production build passed and contains the exact cloud API URL. The checked
  bundle contains no `sb_secret_` key prefix.
- No public frontend deployment has been performed.

The frontend URL below is active for local development; it has not been deployed
to the public frontend. The database password belongs in a private Supabase or
CLI prompt, never in the app.

## How requests and storage work

The browser calls the scheduling API; it does not query Supabase tables directly.
The shared rules in [schedule-service.mjs](../server/schedule-service.mjs) handle
event creation, participant responses, duplicate names, and edit tokens in both
hosting modes. [schedule-fetch.mjs](../server/schedule-fetch.mjs) adapts those rules
to Edge Function requests, and [index.ts](../supabase/functions/schedule-api/index.ts)
connects them to the Supabase store. The Node middleware uses the same service.

| Mode                                        | Frontend setting                                            | Server storage                                      |
| ------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| Local development or a single Node process  | Leave `VITE_SCHEDULE_API_URL` blank                         | Files in `.schedule-data/`, or `SCHEDULE_DATA_DIR`  |
| Node server with shared database storage    | Leave `VITE_SCHEDULE_API_URL` blank                         | Set server `SUPABASE_URL` and `SUPABASE_SECRET_KEY` |
| Static frontend with Supabase Edge Function | Set `VITE_SCHEDULE_API_URL` to the full function events URL | Supabase Postgres through the Edge Function         |

An explicit middleware `dataDir` keeps file-based tests independent of configured
Supabase credentials. Without an explicit store or `dataDir`, `SUPABASE_URL`
selects the Supabase adapter. The adapter checks a document version when saving
and retries conflicting edits, so separate function instances can update shared
events without replacing another participant's changes.

The scheduling table is `public.schedule_events`, with private access: row-level
security is enabled, `anon` and `authenticated` have no table grants or policies,
and the server's `service_role` can read and write. Stored documents include private
edit-token hashes; public API responses omit those hashes.

People still use **name → select times**. Anyone with an event link can read names,
submitted emails, and availability. Retyping a participant's public name can grant
editing access, so it is a courtesy check rather than proof of identity. A browser
can remember multiple participants' edit tokens. No passwords, accounts, or
Supabase user sessions are added to that workflow.

The Edge Function uses atomic database request counters shared by all of its
instances. Per fixed UTC clock hour, it admits up to **100 event-creation requests
across the project** and **1,000 response or edit-access requests per event**.
Response creation, response updates, and name-based edit-access requests share
that event's write budget; traffic to one event does not consume another's budget.
Exhausted budgets return `429` until the next window. These are practical request
bounds, not per-person limits or identity checks.

The [rate limiter](../server/schedule-rate-limit.mjs) checks the HTTP method,
route, and UUID format and verifies that an event exists before charging its
write budget. Malformed or unrelated routes, unsupported methods, and nonexistent
events do not consume these budgets or create counter buckets. Participant-field
validation happens afterward, so an invalid response for an existing event can
still consume that event's budget. The limits are constants in the rate-limiter
module; there are no limit environment-variable overrides. The Node middleware
does not call this Edge Function rate limiter.

The shared service caps new participant additions at **100 people per event**.
Supabase also caps each stored event document at **8 MiB (8,388,608 bytes)**,
measured from the database's JSONB text representation. The request-counter table and
`consume_schedule_limit` RPC are server-only, just like event storage.

## 1. Select the new project

Select **OncoLogic Schedule** in **OncoLogic**, with project reference
`skjooqzogckjlchtayvj`. The `project_id = "oncologic-schedule"` value in
[config.toml](../supabase/config.toml) is a local project label, not the remote
project reference. The commands below target the newly created project; do not
substitute a reference from another OncoLogic project.

Run commands from this repository's root with the Supabase CLI available:

```sh
SCHEDULE_PROJECT_REF="skjooqzogckjlchtayvj"
supabase login
supabase link --project-ref "$SCHEDULE_PROJECT_REF"
```

The CLI may prompt for the database password. Keep it out of committed files and
frontend build settings.

## 2. Record the applied migrations

All three migrations have already been applied manually to this project:

- [202610060001_schedule_events.sql](../supabase/migrations/202610060001_schedule_events.sql)
  creates private-access event storage and its document constraints.
- [202610060002_schedule_request_limits.sql](../supabase/migrations/202610060002_schedule_request_limits.sql)
  creates private fixed-window counters and their atomic consumption RPC.
- [202610060003_restrict_rls_auto_enable.sql](../supabase/migrations/202610060003_restrict_rls_auto_enable.sql)
  removes `PUBLIC`, `anon`, and `authenticated` execution privileges from
  Supabase's generated `public.rls_auto_enable()` helper. Verification confirmed
  those roles cannot execute it, its owner remains `postgres`, and the `ensure_rls`
  event trigger remains enabled. The function and trigger are retained.

After linking the CLI to the project, record those successful manual applications
before using `db push`. This history reconciliation is still pending:

```sh
supabase migration repair 202610060001 202610060002 202610060003 --status applied --linked
supabase migration list --linked
```

That command records migration history; it does not execute the SQL. Do not run
the same table-creation migration twice or mark an unapplied migration complete.

For future pending migrations, review and apply them to the linked project:

```sh
supabase db push --linked --dry-run
supabase db push --linked
```

`db push` records migration versions, and `--dry-run` lists pending migrations.
See the [Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push).
When using a SQL editor instead, run files in filename order and apply each
complete migration as one transaction: retain its `BEGIN`/`COMMIT` if present, or
wrap the whole file in them. This keeps schema changes and access restrictions
together. Record only the migration versions actually applied.

## 3. Configure the function's allowed origins

Set `SCHEDULE_ALLOWED_ORIGINS` to a comma-separated list of exact frontend origins.
Use scheme, host, and port where applicable, with no URL path or trailing slash.
The configured list replaces the defaults; include local development origins only
if this project should accept them.

```sh
supabase secrets set --project-ref "$SCHEDULE_PROJECT_REF" \
  SCHEDULE_ALLOWED_ORIGINS="https://YOUR-FRONTEND.example,http://localhost:5173,http://127.0.0.1:5173"
```

Replace `https://YOUR-FRONTEND.example` with the actual frontend origin. The code's
fallback list includes `https://calculator.medtechstack.com` and local development
and preview origins on ports 5173 and 4173. Explicit configuration is preferable
for a deployment with a different domain. CORS controls browser requests; it does
not verify a participant's identity or make shared event links private.

Supabase supplies `SUPABASE_URL` and server credentials to the Edge Function.
The entrypoint reads the default value in `SUPABASE_SECRET_KEYS` and supports the
legacy `SUPABASE_SERVICE_ROLE_KEY` fallback. Supabase reserves the `SUPABASE_`
prefix, so do not try to create those platform variables through `secrets set`.
See [Edge Function environment variables](https://supabase.com/docs/guides/functions/secrets).

## 4. Deploy the function with its gateway configuration

The dashboard deployment and gateway configuration are complete. The legacy JWT
check was disabled with owner approval, and the saved setting was verified. A
public read for a missing event returns the application handler's `404`, confirming
that requests now reach the function without a Supabase JWT. The live API checks
and cross-browser persistence verification described above passed.

For later deployments from this repository, the equivalent CLI command is:

```sh
supabase functions deploy schedule-api \
  --project-ref "$SCHEDULE_PROJECT_REF" \
  --no-verify-jwt
```

[config.toml](../supabase/config.toml) also sets `verify_jwt = false`. This is
intentional: the API uses its own opaque participant edit tokens in the
`Authorization: Bearer ...` header, rather than Supabase Auth JWTs. The function
still applies the service's validation and edit-token checks; its database remains
accessible only to the server role. The browser needs neither an anon/publishable
key nor a privileged key. Supabase documents [function deployment and configuration](https://supabase.com/docs/guides/functions/deploy).

Deploy from the repository root so the function includes its shared modules in
`server/`. No domain change or frontend hosting pipeline is assumed by this step.

## 5. Point the frontend at the function and rebuild

Local development already uses the following public value in `.env.local`, and
Vite was restarted to load it. The local files were unchanged from the imported
snapshot when the switch occurred. For a later public frontend deployment, set
the same value in that frontend's build environment and rebuild.

```dotenv
VITE_SCHEDULE_API_URL=https://skjooqzogckjlchtayvj.supabase.co/functions/v1/schedule-api/events
```

The URL includes `/events` at the end and is compiled into the browser bundle.
HTTPS is required remotely; HTTP is accepted
only for `localhost`, `127.0.0.1`, and `[::1]` development. Do not include keys,
query parameters, fragments, or credentials in the URL.

For local testing, copy [.env.example](../.env.example) to `.env.local`, set the URL,
and restart `npm run dev`. For deployment, set the variable in the chosen frontend
build environment, run the build, and publish the resulting `dist/` through that
host's existing process:

```sh
npm run build
```

Changing only an environment variable on an already-published static site does
not update its bundled API URL; rebuild and redeploy the frontend. Its host also
needs an SPA fallback to `index.html` so direct `/schedule/<event-id>` links open.
Keep privileged keys, the database password, and CLI access tokens out of all
`VITE_` variables.

## 6. Verify the deployed path

The initial live API and cross-browser persistence checks have passed. Repeat the
following checks after later backend or frontend deployments.

A read for an absent event should reach the handler and return a JSON `404`, with
no Supabase API key:

```sh
curl -i "https://${SCHEDULE_PROJECT_REF}.supabase.co/functions/v1/schedule-api/events/00000000-0000-0000-0000-000000000000"
```

Then create a test event through the built frontend, save separate responses for
two people, and reopen its shared link in another browser. Confirm that both
responses remain, that a remembered name can be edited, and that the time-zone
selector changes the display without changing saved availability. Browser
requests should target the configured function URL, and allowed origins should
receive CORS headers for `content-type` and `authorization`.

Run local regression checks with `npm run test:schedule`. Those tests are separate
from verifying the newly deployed project and frontend.

## Optional: use Supabase storage behind the Node server

To keep the frontend and API on the same Node host, leave `VITE_SCHEDULE_API_URL`
blank and provide these values through the server host's environment or secret
manager:

| Variable                    | Value                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`              | The project base URL, `https://skjooqzogckjlchtayvj.supabase.co` |
| `SUPABASE_SECRET_KEY`       | A server-only `sb_secret_...` key                                |
| `SUPABASE_SERVICE_ROLE_KEY` | Supported legacy fallback if a secret key is not supplied        |

Apply the same database migrations, then use `npm run build` and `npm start`.
The startup script reads the process environment; it does not automatically load
a private `.env` file. Do not expose either privileged key through the browser or
commit it to the repository. `SCHEDULE_DATA_DIR` applies to file mode and does not
override a configured `SUPABASE_URL`.

## Existing local schedules

The initial manual import copied six events with nine participant responses into
Supabase, preserving event IDs, participant IDs, and edit-token hashes. Before the
local app was switched to Supabase, all six events and nine responses were
rechecked and remained unchanged from that snapshot. New changes through the
configured local frontend now go to Supabase. The retained local files are a
snapshot and are not synchronized with subsequent cloud changes.

Switching storage does not itself import `.schedule-data/`. Keep a backup of that
directory. Any further import should run server-side with complete documents,
preserving event IDs, participant IDs, slot keys, and edit-token hashes. Recreating
events through the public creation endpoint would assign new IDs and would not
preserve existing editing access.

Share links using the deployed frontend's origin after a move; `localhost` links
remain local to the device opening them. Browser identities and recent-event
history are also scoped to the frontend's origin, so a new origin can require the
existing name-reclaim workflow even when the event document was preserved.
