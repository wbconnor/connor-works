import type { CSSProperties } from 'react';
import Image from 'next/image';
import type { Project } from '@/app/projects';

/**
 * A home page card (DESIGN.md §5.3–5.5). The whole card is one plain <a>, since it links into
 * another app (AGENTS.md rule 4). The accent color is only used for non-text elements.
 */
export function ProjectCard({ project }: { project: Project }) {
  const style = { '--accent': project.highlightColor ?? 'var(--accent-default)' } as CSSProperties;

  return (
    <a
      href={project.href}
      style={style}
      className="group block h-full overflow-hidden rounded-lg bg-surface outline-1 outline-border transition-[outline-color,box-shadow] duration-150 hover:shadow-[0_4px_16px_color-mix(in_srgb,var(--accent)_35%,transparent)] hover:outline-2 hover:outline-(--accent) focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--accent)"
    >
      <div aria-hidden="true" className="h-1 bg-(--accent)" />
      <Image
        src={project.image}
        alt={project.imageAlt}
        width={1200}
        height={675}
        sizes="(min-width: 960px) 436px, (min-width: 768px) 50vw, 100vw"
        className="aspect-video w-full object-cover grayscale transition-[filter] duration-150 group-hover:grayscale-0 group-focus-visible:grayscale-0"
      />
      <div className="p-4">
        <h2 className="text-xl font-semibold">{project.title}</h2>
        <p className="mt-1 text-base text-ink-muted">{project.description}</p>
      </div>
    </a>
  );
}
