import type { Project } from '@/app/projects';
import { ProjectCard } from './project-card';

/** Card grid, or the empty state until the first child app is deployed (DESIGN.md §5.6, §6.3) */
export function ProjectGrid({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <p className="text-ink-muted">Projects are on the way. Check back soon.</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {projects.map((project) => (
        <li key={project.app}>
          <ProjectCard project={project} />
        </li>
      ))}
    </ul>
  );
}
