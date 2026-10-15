// Home page cards (DESIGN.md §5). The new-child-app skill appends entries here, so keep this
// shape and file location stable. Cards render newest first (reverse array order), and a card
// only appears once its app's urlEnv is set at build time (lib/projects.ts).

export type Project = {
  app: string; // key in the zone registry, e.g. 'meridian-underground'
  title: string; // e.g. 'Meridian Underground'
  description: string; // one sentence, ≤ 140 characters
  href: string; // the app's first prefix, e.g. '/meridian-underground'
  image: string; // path under /public, e.g. '/projects/meridian-underground.webp'
  imageAlt: string; // describes the image, not the app name
  highlightColor?: string; // hex, e.g. '#244653'; falls back to accent-default
  listed: boolean; // false = registered app with no public card
};

export const projects: Project[] = [];
