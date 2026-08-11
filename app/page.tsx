/**
 * Home / landing page
 * -------------------
 * Starting point for apartment owners.
 * Users enter an NYC address below to look up open HPD violations.
 */

import AddressSearchForm from "@/components/AddressSearchForm";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        NYC Open HPD Violations
      </p>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        Check open violations for your building
      </h1>

      <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600">
        Search a New York City address to see open Housing Preservation and
        Development (HPD) violations. Start with the form below — press Enter
        or click Search to look up matching records from NYC Open Data.
      </p>

      <AddressSearchForm />
    </main>
  );
}
