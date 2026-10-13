import { siteDescription } from '@/lib/site';
import { visibleProjects } from '@/lib/projects';
import { stacked, wide } from './_components/ascii-title';
import { ProjectGrid } from './_components/project-grid';
import { projects } from './projects';

export default function Home() {
  // Decided at build time: the page is static (DESIGN.md §5.2)
  const visible = visibleProjects(projects, process.env);

  return (
    <main className="mx-auto w-full max-w-[960px] px-4 pt-16 pb-16 md:px-8">
      <h1>
        <span className="sr-only">Connor dot works</span>
        <pre aria-hidden="true" className="ascii-wide hidden overflow-x-auto leading-[1.1] md:block">
          {wide}
        </pre>
        <pre aria-hidden="true" className="ascii-stacked overflow-x-auto leading-[1.1] md:hidden">
          {stacked}
        </pre>
      </h1>
      <p className="mt-6 max-w-[60ch] text-lg">{siteDescription}</p>
      <div className="mt-12">
        <ProjectGrid projects={visible} />
      </div>
    </main>
  );
}
