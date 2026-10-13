import { connorWorks } from '@connor-works/config/eslint';

const eslintConfig = [
  // eslint-config-next + connor.works rules (no-request-host, cookie-prefix, no-cross-zone-link).
  // Also ignores every nested workspace folder (child apps and the config package).
  // .claude/ holds templates for child apps, not main site code.
  ...connorWorks({ app: 'main-site', ignores: ['.claude/**'] }),
];

export default eslintConfig;
