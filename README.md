This calculator is a responsive template built on top of TailwindCSS and fully coded in React. It comes with a few pre-coded calculators, estimators and visualizers. 

## Live demo

You can check a live demo here 👉️ [https://calculator.medtechstack.com/](https://calculator.medtechstack.com/)

## Usage

This project was bootstrapped with [Vite](https://vitejs.dev/) and Mosaic Lite. 

### Project setup
```
npm install
```

#### Compiles and hot-reloads for development
```
npm run dev
```

#### Compiles and minifies for production
```
npm run build
```

### Deployment 

The live demo if this application is deployed using [AWS Amplify](https://aws.amazon.com/amplify/) which can be a quick solution for deploying frontend only applications. They also offer a generous free tier for new users.

### Shared schedules

The Schedule tab lets an organizer choose dates and a daily time range, then share
one event URL. Participants enter a name, select 15-minute availability slots, and
save their response. Email is optional and recommended for calendar invitations.
Names, submitted emails, and availability are visible to anyone with that URL.
The group can copy submitted email addresses into a calendar invitation; the app
does not send invitations or email messages.
Selecting a suggested meeting time opens a brief editable invitation request.
Copy the message alone, include all submitted email addresses, or copy just the
addresses. Compact copy options switch between comma-separated and one-per-line
email lists.
There are no passwords or accounts. A device can add multiple people using
"Add another person" or "Save & add another". Each person keeps a separate name,
email, and availability; edit tokens for all entries stay in that browser.
Choosing a previously managed name opens it directly for editing. Older
single-entry browser records are preserved when adding more people. On another
device, participants can choose a name, retype it, and confirm that they are
editing their own response or one they have been asked to manage.
This is a courtesy check: names are public, so anyone with the event link can
obtain editing access by entering a participant's name. It does not verify identity.
Opening a response on another device keeps existing devices' editing access.

Dates can be selected by clicking or dragging across the calendar. Each participant's
view defaults to their device's time zone, with a selector to change it. Grid dates,
hours, and meeting suggestions convert together, while responses retain the same
underlying event times. Daylight-saving offsets are calculated for the event date.
Meeting lengths range from 15 minutes to 8 hours in the preset list, with a custom
whole-minute option (1–1,440 minutes, within the event's daily time window).
Suggestions cover the exact meeting length, including custom lengths that end
partway through an available grid cell. Existing events retain their original
30-minute cells and saved responses.
Nonexistent organizer-local times during a spring clock change are omitted; when
an organizer-local time repeats during a fall clock change, the first occurrence
is used. Repeated hours in a participant's viewing zone appear as separate rows.

The scheduling API runs automatically with `npm run dev` and `npm run preview`.
By default, it stores events in local files. For a Node.js 20-or-newer deployment
that serves the app and API together, run:

```sh
npm run build
npm start
```

The production server serves the built app and API together, including direct
links to events. It listens on `0.0.0.0:3000` by default; set `HOST` and `PORT` to
change those values. Put your normal HTTPS reverse proxy in front of it when
hosting publicly. A static frontend can instead use the Supabase Edge Function
described below; it needs a configured scheduling API to collect shared responses.

In local-file mode, event records persist in `.schedule-data/` (excluded from Git). Set
`SCHEDULE_DATA_DIR` to an absolute directory on a persistent volume in production,
and back up that directory as needed. Run one Node process against each data
directory. Writes are serialized within that process and use atomic replacement;
multiple server processes must use a shared transactional database instead.
Public API responses omit the edit token hashes stored with each response. An
explicit `dataDir` passed to the middleware keeps tests in file mode. Otherwise,
setting `SUPABASE_URL` in the Node server environment selects Supabase storage;
provide `SUPABASE_SECRET_KEY` there as a server-only credential.

#### Supabase deployment

The app also supports a static frontend backed by the `schedule-api` Supabase Edge
Function and a private-access Postgres table. Set the public events URL and
optional execution region in the frontend build environment:

```dotenv
VITE_SCHEDULE_API_URL=https://skjooqzogckjlchtayvj.supabase.co/functions/v1/schedule-api/events
VITE_SCHEDULE_FUNCTION_REGION=us-east-1
```

No Supabase API key is needed in the browser. Privileged database credentials stay
in the Edge Function or Node server environment. The function deliberately uses
`verify_jwt = false` because event links, participant edit tokens, and the existing
name-reclaim workflow govern access. This preserves the documented courtesy model;
it does not add identity verification.

The Edge Function allows 100 event-creation requests per hour across the project
and 1,000 response or edit-access requests per event per hour. Events support up
to 100 participants; Supabase limits each stored event document to 8 MiB. These
bounds do not change the link-sharing and courtesy-editing model.

See [Supabase setup and deployment](docs/supabase-setup.md) for the new **OncoLogic
Schedule** project in the **OncoLogic** organization, database migrations, allowed
browser origins, deployment commands, and frontend rebuilding. All three migrations
have been applied manually and the function is deployed. Six local events with
nine participant responses were imported, preserving IDs and edit-token hashes.
The gateway's legacy JWT check was disabled with approval, and a missing-event
request now reaches the application handler and returns `404`. The local app uses
Supabase through `.env.local`; 24 live API checks and cross-browser persistence
verification passed. The production build also passed. CLI migration-history
reconciliation remains pending. The public frontend is deployed through AWS
Amplify at `https://calculator.medtechstack.com/schedule`.

API endpoints below use the local Node prefix. With Supabase, replace
`/api/schedule/events` with the configured full events URL; payloads and edit-token
headers stay the same.

- `POST /api/schedule/events`: create an event with `title`, optional
  `description`, `dates` (`YYYY-MM-DD`), `startTime`, `endTime`, IANA `timezone`, and
  `duration` (1–1,440 whole minutes, within the daily range). Time boundaries use
  15-minute increments. New events return `slotMinutes: 15`; older events retain
  `slotMinutes: 30`.
- `GET /api/schedule/events/:id`: retrieve the event and participants.
- `POST /api/schedule/events/:id/participants`: save `{ name, email?, slots }`; slot keys
  use `YYYY-MM-DD@HH:mm` in the event's time zone. Returns `{ participant,
  editToken }` once.
- `PUT /api/schedule/events/:id/participants/:participantId`: replace a response
  with `{ name, email?, slots }`, using `Authorization: Bearer <editToken>`.
  Omitting `email` preserves an existing address; `email: ""` clears it. Email
  addresses are trimmed, validated, and limited to 254 characters. Public
  participant responses include `email`, using an empty string when none is saved.
- `POST /api/schedule/events/:id/participants/:participantId/edit-access`: open an
  existing response on another device with `{ name }`. A matching name returns
  `{ participant, editToken }`; comparisons ignore letter case and repeated spaces.
  Each response supports its original token plus up to 100 additional device
  tokens, without expiring existing devices. Tokens are stored only as hashes.

Run the API persistence, validation, edit permission, and concurrency checks with
`npm run test:schedule`.

### Support notes 

We are shipping this templates with a very basic React configuration to let you quickly get into the development process, but we don't discourage you from using any other configuration or framework built on the top of React. 


## Data Explorer (beta) Key Features

- Full front-end solution: No server uploads, all processing done in-browser
- CSV file parsing with support for large files (up to 5MB)
- Dynamic table generation with sorting and filtering capabilities
- Column selection for customized views
- Advanced filtering options including text and numeric filters
- Saved configurations for quick access to frequent analyses
- Responsive design built with TailwindCSS

## Milestone Risk Calculator

This tool allows users to estimate survival probabilities and treatment effects.

### How to Use:

1. Enter the survival probability for the control group at a specific time point.
2. Input the Hazard Ratio (HR) from a relevant clinical trial.
3. The calculator will estimate:
   - Survival probability for the treatment group
   - Absolute risk reduction
   - Approximations of median and mean survival times

## Technical Details
- Built with React and modern JavaScript
- Utilizes Web Workers for efficient CSV parsing
- Implements chunking for handling large datasets
- Real-time search and filter functionality
- Responsive UI powered by TailwindCSS

## Terms and License

- Released under the [MIT](https://opensource.org/license/mit).
- We do not guarantee the accuracy or completeness of any code or content, and you are using this repo and tools at your own discretion and risk. No warranty, express or implied, is provided, and we disclaim all implied warranties.
