import { connorWorks } from '@connor-works/config/eslint';

export default [
  // eslint-config-next + connor.works rules (no-request-host, cookie-prefix, no-cross-zone-link)
  ...connorWorks({ app: '{{APP}}' }),
  // App-specific configs go here
];
