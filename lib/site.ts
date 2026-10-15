/** Absolute base URL, from SITE_URL (AGENTS.md rule 3). Never build URLs from the request's Host header. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export const siteName = 'connor.works';

/** Home page intro (DESIGN.md §6.2), also the site's meta description */
export const siteDescription = 'A home for the things I build. Pick a project below and have a look around.';
