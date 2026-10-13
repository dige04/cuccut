import type { ToolSet } from './tool-catalog.ts';
import { CompositionTools } from './composition-tools.ts';
import { DownloadTools } from './download-tools.ts';
import { ExportTools } from './export-tools.ts';
import { FlowTools } from './flow-tools.ts';
import { GrantTools } from './grant-tools.ts';
import { JobTools } from './job-tools.ts';
import { LibraryTools } from './library-tools.ts';
import { LinkImportTools } from './link-import-tools.ts';
import { ModelInstallTools } from './model-install-tools.ts';
import { ModelTools } from './model-tools.ts';
import { ProjectTools } from './project-tools.ts';
import { ReviewTools } from './review-tools.ts';
import { SkillTools } from './skill-tools.ts';
import { SlidesTools } from './slides-tools.ts';
import { DesignTools } from './design-tools.ts';
import { DesignSystemTools } from './design-system-tools.ts';
import { SpaceTools } from './space-tools.ts';
import { TaskTools } from './task-tools.ts';
import { VideoDeleteTools } from './video-delete-tools.ts';
import { VideoTools } from './video-tools.ts';

/**
 * Empty shells of every tool group the Runtime assembles (`toolSets` in `runtime.ts`): all dependencies are empty; they
 * are only for reading schemas and catalog entries and cannot be called.
 * The CLI's offline catalog snapshot (`tools/catalog-snapshot.ts`, generated at build time) and the catalog tests use it,
 * which is why it lives here rather than in `testing/`.
 * The tool bridge's end-to-end test asserts that tools/list matches the tool names here; it fails when the Runtime adds a
 * tool group that is not added here.
 */
export function allToolSets(): ToolSet[] {
  const none = {} as never;
  return [
    new VideoTools(none),
    new ModelTools(none),
    new JobTools(none),
    new ExportTools(none),
    new ReviewTools(none),
    new ModelInstallTools(none),
    new ProjectTools(none),
    new LibraryTools(none),
    new SpaceTools(none),
    new SkillTools(none),
    new GrantTools(none),
    new TaskTools(none),
    new LinkImportTools(none),
    new FlowTools(none),
    new DownloadTools(none),
    new VideoDeleteTools(none),
    new CompositionTools(none),
    new SlidesTools(none),
    new DesignTools(none),
    new DesignSystemTools(none),
  ];
}

/** All tool names, sorted alphabetically. */
export function allToolNames(): string[] {
  return allToolSets()
    .flatMap((set) => Object.keys(set.schemas))
    .sort();
}
