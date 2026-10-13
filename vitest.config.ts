import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname) },
  },
  test: {
    include: ['test/**/*.test.ts', 'lib/**/*.test.ts', 'app/**/*.test.ts'],
    // Nested repos have their own tests
    exclude: ['**/node_modules/**', 'connor-works-config/**', 'meridian-underground/**'],
  },
});
