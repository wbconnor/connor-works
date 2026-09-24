import path from 'node:path';
import { expect, test } from 'vitest';
import { findRouteViolations } from '@connor-works/config/routes';

// Fails if app/ creates URLs outside this app's prefixes in the connor.works zone registry
test('app only creates routes under its own prefixes', () => {
  expect(findRouteViolations({ app: '{{APP}}', appDir: path.join(process.cwd(), 'app') })).toEqual([]);
});
