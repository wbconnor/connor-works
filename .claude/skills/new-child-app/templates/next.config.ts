import type { NextConfig } from 'next';
import { childNextConfig } from '@connor-works/config/next';

// Sets assetPrefix ('{{ASSET_PREFIX}}' in production), images.unoptimized,
// serverActions.allowedOrigins (from ALLOWED_ORIGINS), and the pinned project root
// (outputFileTracingRoot / turbopack.root; locally this repo is nested inside connor-works/).
const base = childNextConfig('{{APP}}', __dirname);

const nextConfig: NextConfig = {
  ...base,
  // App-specific settings: merge nested objects (e.g. `experimental`) with `base`, don't replace them
};

export default nextConfig;
