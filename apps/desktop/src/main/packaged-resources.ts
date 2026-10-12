import path from 'node:path';

/**
 * 打包后的应用里，Runtime 与 Worker 按路径读的东西在 `<resources>`（Electron 的 `process.resourcesPath`，asar 外面）的哪里。
 * 主进程、打包脚本（`tools/package-desktop.mjs`）与产物检查（`tools/check-packaged-app.mjs`）都从这一份取，不各写一遍。
 *
 * Runtime 以 Node 方式运行（`ELECTRON_RUN_AS_NODE`）时不一定拿得到 `process.resourcesPath`，所以主进程把这些位置经环境变量告诉它；
 * 开发时不给，Runtime 自己从仓库里找（仓库约定 §2「随应用分发的数据文件不按模块相对路径找」）。
 */

/** `<resources>` 下的子目录。 */
export const RESOURCE_DIRS = {
  /** 原生可执行文件：Worker、凭据助手，以及它们要的 DLL（Windows 的 CUDA 运行库放在 Model Worker 旁边）。 */
  bin: 'bin',
  /** 内置创作模板（仓库根的 `templates/`）。 */
  templates: 'templates',
  /**
   * 仓库根的 `skills/`：`cuccut/` 是给 Agent 的说明书（`cuccut skill install` 渲染后装进宿主），`cuccut/built-in-skills/`
   * 是内置 Agent skill。
   */
  skills: 'skills',
  /** 自测样本与内置音色的录音（`packages/models/assets`）。 */
  modelAssets: 'model-assets',
  /** Web 客户端的构建产物（`apps/web/dist`）。 */
  web: 'web',
  /** 幻灯片编辑器的构建产物（`apps/slides-editor/dist`）：编辑器页面与 slides_check 用的编译器。 */
  slidesEditor: 'slides-editor',
  /** 设计稿编辑器的构建产物（`apps/design-editor/dist`）：编辑器页面、画板运行时与快速编辑 Worker。 */
  designEditor: 'design-editor',
  /** 设计系统编辑器的构建产物（`apps/design-system-editor/dist`）：编辑器页面、预览页 run.html 与预览用的 React UMD。 */
  designSystemEditor: 'design-system-editor',
} as const;

/** `bin/` 里的原生程序（不带后缀）：同一次 cargo 构建出来的 Worker、凭据助手与人脸检测（`face-detect`）。 */
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

/** 由资源目录算出各个位置。`pathApi` 让检查脚本在别的平台上按 Windows 的写法算。 */
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

/** 交给 Runtime 的环境变量（Runtime 各自的解析函数第一个看的就是它们）。 */
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
