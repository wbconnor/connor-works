import { notFound } from './_components/ascii-title';

// Served for every unknown path on the domain, including mistyped child app URLs (DESIGN.md §7)
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[960px] px-4 pt-16 pb-16 md:px-8">
      <h1>
        <span className="sr-only">Page not found</span>
        <pre aria-hidden="true" className="text-base leading-[1.1]">
          {notFound}
        </pre>
      </h1>
      <p className="mt-6 text-lg">
        That page doesn&apos;t exist.{' '}
        {/* Plain <a> per DESIGN.md §7: this page can render under any path, so reload the home page fully */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="underline underline-offset-4">
          Back to the home page
        </a>
      </p>
    </main>
  );
}
