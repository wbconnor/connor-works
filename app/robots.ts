import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * Disallow rules for each child app, keyed by its name in the zone registry. The main site
 * serves robots.txt for the whole domain (ARCHITECTURE.md §5.3), so every child app needs an
 * entry here, even an empty one. The new-child-app skill adds a block per app.
 */
export const childAppDisallow: Record<string, string[]> = {
  // meridian-underground
  'meridian-underground': ['/movie-night/', '/meridian-underground/admin/'],
};

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...Object.values(childAppDisallow).flat()],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
