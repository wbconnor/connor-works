import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { MAIN_SITE, getZone, zones } from '@connor-works/config';
import { projects, type Project } from '@/app/projects';
import { contrastRatio, isHexColor } from '@/lib/contrast';
import { visibleProjects } from '@/lib/projects';

const SURFACE = '#E8E8E8'; // card background (DESIGN.md §4.1)

describe('app/projects.ts', () => {
  test('lists each app at most once', () => {
    const apps = projects.map((project) => project.app);
    expect(new Set(apps).size).toBe(apps.length);
  });

  test.each(projects)('$app is a valid card', (project) => {
    expect(Object.keys(zones)).toContain(project.app);
    expect(project.app).not.toBe(MAIN_SITE);
    expect(project.href).toBe(getZone(project.app).prefixes[0]);
    expect(project.title.trim()).not.toBe('');
    expect(project.description.length).toBeLessThanOrEqual(140);
    expect(project.imageAlt.trim()).not.toBe('');
    expect(existsSync(path.join(process.cwd(), 'public', project.image))).toBe(true);
  });

  // Accent colors are used for focus outlines, so they need the WCAG 3:1 minimum (DESIGN.md §5.5)
  test.each(projects.filter((project) => project.highlightColor))(
    '$app highlightColor has 3:1 contrast on surface',
    (project) => {
      const color = project.highlightColor!;
      expect(isHexColor(color)).toBe(true);
      expect(contrastRatio(color, SURFACE)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe('visibleProjects', () => {
  const project = (overrides: Partial<Project>): Project => ({
    app: 'meridian-underground',
    title: 'Meridian Underground',
    description: 'A home theater.',
    href: '/meridian-underground',
    image: '/projects/placeholder.webp',
    imageAlt: 'A placeholder',
    listed: true,
    ...overrides,
  });
  const env = { MERIDIAN_UNDERGROUND_URL: 'http://meridian-underground.railway.internal:3000' };

  test('shows listed projects whose urlEnv is set', () => {
    expect(visibleProjects([project({})], env)).toHaveLength(1);
  });

  test('hides a project whose urlEnv is unset or empty', () => {
    expect(visibleProjects([project({})], {})).toEqual([]);
    expect(visibleProjects([project({})], { MERIDIAN_UNDERGROUND_URL: '' })).toEqual([]);
  });

  test('hides unlisted projects', () => {
    expect(visibleProjects([project({ listed: false })], env)).toEqual([]);
  });

  test('returns newest (last appended) first without mutating the input', () => {
    const list = [project({ title: 'First' }), project({ title: 'Second' })];
    expect(visibleProjects(list, env).map((p) => p.title)).toEqual(['Second', 'First']);
    expect(list[0].title).toBe('First');
  });

  test('throws for an app missing from the registry', () => {
    expect(() => visibleProjects([project({ app: 'no-such-app' })], env)).toThrow(/Unknown connor.works app/);
  });
});

describe('contrastRatio', () => {
  test('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#1A1A1A', SURFACE)).toBeGreaterThan(14);
  });

  test("accepts Meridian Underground's Rainstorm and rejects a pale color", () => {
    expect(contrastRatio('#244653', SURFACE)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio('#B5B5B5', SURFACE)).toBeLessThan(3);
  });
});
