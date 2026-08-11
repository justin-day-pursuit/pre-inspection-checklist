# Pre-Inspection Checklist

Create a checklist after a tenant moves out and before the official inspection.
Current project scope is **New York City (NYC)** addresses in the United States.

This app is built with **Next.js + React + TypeScript** so it deploys easily on **Vercel**.
Google **Gemini 3.6 Flash** (`gemini-3.6-flash`) is wired on the server for AI prompting.

## What works today

- Project scaffolding (App Router, TypeScript, Tailwind)
- Local env setup for your Gemini API key
- Server-side Gemini helpers (Server Action + API Route)
- A simple address search page (UI only — **does not send data** on Enter or Search click)
- Build verification with `npm run build` / `npm run check`

## Not included yet

- Real address lookup / autocomplete
- Connecting search to Gemini
- Recording or screenshot capture (skipped for this phase)
- Saving/exporting completed checklists

## Prerequisites

- Node.js 20+ and npm
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local env file:

```bash
cp .env.example .env.local
```

3. Open `.env.local` and paste your key:

```bash
GEMINI_API_KEY=your_key_here
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Gemini configuration

| Item | Value |
| --- | --- |
| Env variable | `GEMINI_API_KEY` |
| Model | `gemini-3.6-flash` |
| Helper | `lib/gemini.ts` |
| Server Action | `app/actions/gemini.ts` |
| API Route | `POST /api/gemini` |

The address search form does **not** call Gemini yet. That keeps the first UI safe while you add your key and verify the project builds.

### Optional: test the API Route manually

After adding your key and starting the app:

```bash
curl -X POST http://localhost:3000/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello in one short sentence."}'
```

## Verify the build

Use this to confirm TypeScript and Next.js compile cleanly (recommended before deploying):

```bash
npm run build
```

Or the shorthand:

```bash
npm run check
```

## Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build (compile check) |
| `npm run check` | Same as `npm run build` |
| `npm run start` | Run the production build locally |
| `npm run lint` | Run ESLint |

## Project layout (high level)

```text
app/
  page.tsx                 # Home page with address search
  layout.tsx               # Shared page shell
  actions/gemini.ts        # Server Action for Gemini prompts
  api/gemini/route.ts      # HTTP API for Gemini prompts
components/
  AddressSearchForm.tsx    # Search UI that does not submit yet
lib/
  gemini.ts                # Shared Gemini client helper
.env.example               # Safe template for env variable names
.env.local                 # Your real key (gitignored — do not commit)
```

## Notes for maintainers

- Put secrets only in `.env.local`. Never commit API keys.
- Restart `npm run dev` after changing env files.
- If you change the address form later, keep Gemini calls on the server (Server Action or API Route), not in browser code.
- Comments in the code explain each major section in plain language.
