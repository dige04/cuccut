import path from 'node:path';

/**
 * Where, inside `<resources>` (Electron's `process.resourcesPath`, outside the asar), the files that the Runtime and Workers read by path live in a packaged app.
 * The main process, the packaging script (`tools/package-desktop.mjs`) and the artifact check (`tools/check-packaged-app.mjs`) all take them from this one place, rather than each keeping its own copy.
 *
 * When the Runtime runs in Node mode (`ELECTRON_RUN_AS_NODE`), it may not have `process.resourcesPath`, so the main process tells it these locations through environment variables.
 * In development these are not given, and the Runtime finds them itself in the repository (repository convention §2: “data files shipped with the app are not located by module-relative paths”).
 */

/** Subdirectories under `<resources>`. */
export const RESOURCE_DIRS = {
  /** Native executables: the Worker, the credential helper, and the DLLs they need (on Windows, the CUDA runtime libraries sit next to the Model Worker). */
  bin: 'bin',
  /** Built-in authoring templates (`templates/` at the repository root). */
  templates: 'templates',
  /**
   * `skills/` at the repository root: `cuccut/` is the instruction manual for agents (rendered by `cuccut skill install` and installed into the host), and `cuccut/built-in-skills/`
   * holds the built-in agent skills.
   */
  skills: 'skills',
  /** Self-test samples and recordings of the built-in voices (`packages/models/assets`). */
  modelAssets: 'model-assets',
  /** Build output of the web client (`apps/web/dist`). */
  web: 'web',
  /** Build output of the slide editor (`apps/slides-editor/dist`): the editor page and the compiler used by slides_check. */
  slidesEditor: 'slides-editor',
  /** Build output of the design editor (`apps/design-editor/dist`): the editor page, the canvas runtime and the quick-edit Worker. */
  designEditor: 'design-editor',
  /** Build output of the design system editor (`apps/design-system-editor/dist`): the editor page, the preview page run.html, and the React UMD build used for previews. */
  designSystemEditor: 'design-system-editor',
} as const;

/** Native programs in `bin/` (no file extension): the Worker, the credential helper and face detection (`face-detect`), all produced by the same cargo build. */
export const BUNDLED_EXECUTABLES = ['engine-host', 'export-worker', 'model-worker', 'speech-worker', 'credential-helper', 'face-detect'] as const;

export interface PackagedResources {
  binDir: string;
  templatesDir: string;
  skillsDir: string;
  agentSkillsDir: string;
  modelAssetsDir: string;
  webDist: string;
  slidesEditorDist: string;
  designEditorDist: string;
  designSystemEditorDist: string;
}

/** Computes each location from the resources directory. `pathApi` lets the check script compute paths using Windows conventions when running on another platform. */
export function packagedResources(resourcesPath: string, pathApi: path.PlatformPath = path): PackagedResources {
  return {
    binDir: pathApi.join(resourcesPath, RESOURCE_DIRS.bin),
    templatesDir: pathApi.join(resourcesPath, RESOURCE_DIRS.templates),
    skillsDir: pathApi.join(resourcesPath, RESOURCE_DIRS.skills, 'cuccut', 'built-in-skills'),
    agentSkillsDir: pathApi.join(resourcesPath, RESOURCE_DIRS.skills),
    modelAssetsDir: pathApi.join(resourcesPath, RESOURCE_DIRS.modelAssets),
    webDist: pathApi.join(resourcesPath, RESOURCE_DIRS.web),
    slidesEditorDist: pathApi.join(resourcesPath, RESOURCE_DIRS.slidesEditor),
    designEditorDist: pathApi.join(resourcesPath, RESOURCE_DIRS.designEditor),
    designSystemEditorDist: pathApi.join(resourcesPath, RESOURCE_DIRS.designSystemEditor),
  };
}

/** Environment variables passed to the Runtime (each of the Runtime's resolution functions checks these first). */
export function packagedResourceEnv(resources: PackagedResources, platform: NodeJS.Platform = process.platform): Record<string, string> {
  return {
    CUCCUT_BIN_DIR: resources.binDir,
    CUCCUT_TEMPLATES_DIR: resources.templatesDir,
    CUCCUT_SKILLS_DIR: resources.skillsDir,
    CUCCUT_AGENT_SKILLS_DIR: resources.agentSkillsDir,
    CUCCUT_MODEL_ASSETS_DIR: resources.modelAssetsDir,
    CUCCUT_WEB_DIST: resources.webDist,
    CUCCUT_SLIDES_EDITOR_DIST: resources.slidesEditorDist,
    CUCCUT_DESIGN_EDITOR_DIST: resources.designEditorDist,
    CUCCUT_DESIGN_SYSTEM_EDITOR_DIST: resources.designSystemEditorDist,
    ...(platform === 'darwin' ? { PMETAL_METALLIB_PATH: path.join(resources.binDir, 'mlx.metallib') } : {}),
  };
}
