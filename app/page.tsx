/**
 * Home page
 * ---------
 * Landing screen for the pre-inspection checklist app.
 * Right now it only shows an address search form that does not submit data.
 *
 * Later we can connect search results to checklist generation (Gemini helpers
 * already live in `lib/gemini.ts`, `app/actions/gemini.ts`, and `app/api/gemini`).
 */

import AddressSearchForm from "@/components/AddressSearchForm";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Pre-Inspection Checklist
      </p>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        Prepare for the move-out inspection
      </h1>

      <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
        Find a property address to start building a checklist after a tenant
        moves out and before the official inspection. Current scope is New York
        City addresses in the United States.
      </p>

      {/* Search is UI-only for now — see AddressSearchForm comments */}
      <AddressSearchForm />
    </main>
  );
}
