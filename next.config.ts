import type { NextConfig } from 'next';
import { zoneRewrites } from '@connor-works/config/next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // For each child app whose *_URL is set: `${prefix}/:path*` → `${url}${prefix}/:path*`
  // for every prefix plus its asset prefix (ARCHITECTURE.md §5.2)
  async rewrites() {
    return zoneRewrites();
  },
};

export default nextConfig;
