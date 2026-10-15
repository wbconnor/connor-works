import path from 'node:path';
import { expect, test } from 'vitest';
import { findRouteViolations } from '@connor-works/config/routes';

// Fails if app/ creates a page under a child app's prefix, which would hide that app's page
test('main site creates no routes under child app prefixes', () => {
  expect(findRouteViolations({ app: 'main-site', appDir: path.join(process.cwd(), 'app') })).toEqual([]);
});
