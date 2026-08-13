# Pre-Inspection Checklist / NYC Open HPD Violations

Help apartment owners look up **open HPD violations** for New York City buildings.
Enter an address on the landing page; the app queries NYC Open Data and shows matching violations in a filterable table.

Built with **Next.js + React + TypeScript** for easy **Vercel** deploys.
Google **Gemini 3.6 Flash** is still available on the server for later AI features.

## What works today

- Landing page with NYC address search
- Server-side SODA3 query to Open HPD Violations (`csn4-vhvf`)
- Loading spinner under the form while waiting
- After the API call finishes, the page scrolls so the search form is at the top
- Results table: Vio #, Vio code, Class, Descript, Apt, Date (`novissueddate`)
- Client-side per-column filters (dropdowns + Descript text search) within results
- Clear messages for empty / no violation found / invalid / too little information / error / timeout
- Gemini helpers remain available (`lib/gemini.ts`, Server Action, `/api/gemini`)
- Build verification with `npm run check` (`npm test` then `npm run build`)
- Lightweight Node tests via `npm test`

## Not included yet

- Nearby-area / map radius search
- Recording or screenshot capture
- Saving/exporting checklists
- Wiring Gemini into the violations UI

## Prerequisites

- Node.js ≥ 20.3 and npm
- An NYC Open Data / Socrata **App Token** (required for SODA3)
- Optional: NYC Open Data username + password for Basic Auth
- Optional: Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local env file (if you do not already have one):

```bash
cp .env.example .env.local
```

3. Open `.env.local` and fill in:

```bash
# Required for violation search
NYC_OPENDATA_APP_TOKEN=your_app_token_here

# Optional Basic Auth for your NYC Open Data account
NYC_OPENDATA_USERNAME=
NYC_OPENDATA_PASSWORD=

# Already set to the Open HPD Violations SODA3 endpoint
NYC_OPENDATA_BASE_URL=https://data.cityofnewyork.us/api/v3/views/csn4-vhvf/query.json

# Optional Gemini key for later AI features
GEMINI_API_KEY=
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## How address search works

1. User types an NYC address on the landing page.
2. After a short pause, the app classifies the typed text, then (when valid) calls `POST /api/addresses/suggest` and shows under the search bar:
   - a spinner (**Waiting for data**), or
   - a list of matching unique buildings, or
   - `Too little information` / `Invalid search` / `No match found`
3. Clicking a listed address calls `POST /api/violations` for that building.
4. While waiting for violations, a spinner shows **Waiting for data**.
5. When the call finishes, the page scrolls so the search form is at the top.
6. Outcomes for both check and violations calls:
   - **Success** → match list or filterable violations table
   - **Empty (address check)** → `No match found` (no matching building)
   - **Empty (violations)** → `No violation found` (valid building, zero open violations)
   - **Too little information** → house-only or street fragment too short (no Open Data call)
   - **Invalid search** → jumbled / non-address text (no Open Data call)
   - **Error** → `Error in getting data` (also logged)
   - **Timeout** → `Connection timed out` (15s client / 10s server; client abort also cancels the server NYC fetch)

Secrets stay on the server. The browser never receives your App Token or password.

## NYC Open Data configuration

| Item | Value |
| --- | --- |
| Dataset | Open HPD Violations (`csn4-vhvf`) |
| Protocol | SODA3 `POST .../query.json` |
| App Token header | `X-App-Token` |
| Env vars | `NYC_OPENDATA_APP_TOKEN`, `NYC_OPENDATA_USERNAME`, `NYC_OPENDATA_PASSWORD`, `NYC_OPENDATA_BASE_URL` |
| Helper | `lib/nyc-opendata.ts` |
| Address parse / classify | `lib/address-query.ts` |
| Address check API | `POST /api/addresses/suggest` |
| Violations API | `POST /api/violations` |
| Client timeout | 15 seconds |
| Server timeout | 10 seconds |

Table columns shown:

| UI label | Dataset field |
| --- | --- |
| Vio # | `violationid` |
| Vio code | `ordernumber` |
| Class | `class` |
| Descript | `novdescription` |
| Apt | `apartment` (may be empty) |
| Date | `novissueddate` |

## Gemini configuration (optional)

| Item | Value |
| --- | --- |
| Env variable | `GEMINI_API_KEY` |
| Model | `gemini-3.6-flash` |
| Helper | `lib/gemini.ts` |
| Server Action | `app/actions/gemini.ts` |
| API Route | `POST /api/gemini` |

## Verify the build

```bash
npm run check
```

Runs `npm test` then `npm run build`. Or run them separately.

## Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build (compile check) |
| `npm run check` | Run `npm test` then `npm run build` |
| `npm test` | Run Node tests for address classify + filter helpers |
| `npm run start` | Run the production build locally |
| `npm run lint` | Run ESLint |

## Project layout (high level)

```text
app/
  page.tsx                    # Landing page
  layout.tsx                  # Shared page shell
  api/addresses/suggest/route.ts  # Address-check (match list while typing)
  api/violations/route.ts     # Selected address → open violations
  api/gemini/route.ts         # Optional Gemini HTTP API
  actions/gemini.ts           # Optional Gemini Server Action
components/
  AddressSearchForm.tsx       # Suggest list + violations search UI
  ViolationsResults.tsx       # Filterable violations table
lib/
  address-query.ts            # Client-safe address parse / classify
  violations-filters.ts       # Client-safe table filter helpers
  nyc-opendata.ts             # SODA3 helper (server only)
  violations-types.ts         # Shared TypeScript types
  gemini.ts                   # Gemini helper (server only)
  *.test.ts                   # Node built-in tests (tsx)
.env.example                  # Safe template for env variable names
.env.local                    # Your real secrets (gitignored — do not commit)
```

## Notes for maintainers

- Put secrets only in `.env.local`. Never commit API keys or passwords.
- Restart `npm run dev` after changing env files.
- Keep NYC Open Data and Gemini calls on the server (API Routes / Server Actions).
- Comments in the code explain each major section in plain language.
