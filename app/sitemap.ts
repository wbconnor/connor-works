import type { MetadataRoute } from 'next';
import { visibleProjects } from '@/lib/projects';
import { siteUrl } from '@/lib/site';
import { projects } from './projects';

// The home page plus every project that has a visible card (DESIGN.md §9.2)
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/` },
    ...visibleProjects(projects, process.env).map((project) => ({ url: `${base}${project.href}` })),
  ];
}
