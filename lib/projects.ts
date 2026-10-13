import { getZone } from '@connor-works/config';
import type { Project } from '@/app/projects';

/**
 * Projects to show on the home page, newest first (DESIGN.md §5.2). A project is visible when
 * it's `listed` and its app's `urlEnv` (e.g. MERIDIAN_UNDERGROUND_URL) is set, so a card never
 * goes live before its app's rewrites do.
 */
export function visibleProjects(list: readonly Project[], env: Record<string, string | undefined>): Project[] {
  return list
    .filter((project) => {
      const { urlEnv } = getZone(project.app);
      return project.listed && urlEnv !== null && Boolean(env[urlEnv]);
    })
    .reverse();
}
