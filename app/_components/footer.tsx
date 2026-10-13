import { cacheLife } from 'next/cache';
import { siteName } from '@/lib/site';

// Cached so the page can still be prerendered; refreshed daily so the year rolls over
async function currentYear() {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

/**
 * Full-width band (DESIGN.md §6.4): fades from the page background to the footer color over
 * the first 2rem, with the text in the solid bottom 1rem.
 */
export async function Footer() {
  return (
    <footer className="flex h-12 w-full items-end bg-[linear-gradient(to_bottom,var(--bg),var(--footer)_2rem)]">
      <p className="flex h-4 w-full items-center justify-center text-sm text-bg">
        © {await currentYear()} {siteName}
      </p>
    </footer>
  );
}
