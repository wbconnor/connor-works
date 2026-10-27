import { connorWorks } from '@connor-works/config/eslint';

const eslintConfig = [
  // eslint-config-next + connor.works rules (no-request-host, cookie-prefix, no-cross-zone-link)
  ...connorWorks({ app: '{{APP}}' }),
  // App-specific configs go here
];

export default eslintConfig;
