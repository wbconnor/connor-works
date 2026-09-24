import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests only; Playwright specs live in e2e/
    include: ['test/**/*.test.ts', 'lib/**/*.test.ts'],
  },
});
