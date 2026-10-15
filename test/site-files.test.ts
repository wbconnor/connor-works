import { afterEach, describe, expect, test, vi } from 'vitest';
import { MAIN_SITE, zones } from '@connor-works/config';
import robots, { childAppDisallow } from '@/app/robots';
import sitemap from '@/app/sitemap';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('robots.txt', () => {
  test('has a block for every child app in the registry', () => {
    const childApps = Object.keys(zones).filter((app) => app !== MAIN_SITE);
    expect(Object.keys(childAppDisallow).sort()).toEqual(childApps.sort());
  });

  test('disallows /api/ and every child app rule, and points at the sitemap on SITE_URL', () => {
    vi.stubEnv('SITE_URL', 'https://connor.works/');
    const { rules, sitemap: sitemapUrl } = robots();
    const { disallow } = Array.isArray(rules) ? rules[0] : rules;
    expect(disallow).toContain('/api/');
    for (const rule of Object.values(childAppDisallow).flat()) expect(disallow).toContain(rule);
    expect(sitemapUrl).toBe('https://connor.works/sitemap.xml');
  });
});

describe('sitemap.xml', () => {
  test('lists the home page on SITE_URL', () => {
    vi.stubEnv('SITE_URL', 'https://connor.works');
    expect(sitemap()[0]).toEqual({ url: 'https://connor.works/' });
  });
});
