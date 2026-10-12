import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { packagedResourceEnv, packagedResources } from './packaged-resources.ts';

describe('packagedResources', () => {
  it('places every runtime resource under the resources directory', () => {
    const resources = packagedResources('C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources', path.win32);
    expect(resources).toEqual({
      binDir: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources\\bin',
      templatesDir: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources\\templates',
      skillsDir: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources\\skills\\cuccut\\built-in-skills',
      agentSkillsDir: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources\\skills',
      modelAssetsDir: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources\\model-assets',
      webDist: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources\\web',
      slidesEditorDist: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources\\slides-editor',
      designEditorDist: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources\\design-editor',
      designSystemEditorDist: 'C:\\Users\\a\\AppData\\Local\\Programs\\CucCut\\resources\\design-system-editor',
    });
  });

  it('hands the Runtime one environment variable per location', () => {
    const env = packagedResourceEnv(packagedResources('/r', path.posix), 'win32');
    expect(env).toEqual({
      CUCCUT_BIN_DIR: '/r/bin',
      CUCCUT_TEMPLATES_DIR: '/r/templates',
      CUCCUT_SKILLS_DIR: '/r/skills/cuccut/built-in-skills',
      CUCCUT_AGENT_SKILLS_DIR: '/r/skills',
      CUCCUT_MODEL_ASSETS_DIR: '/r/model-assets',
      CUCCUT_WEB_DIST: '/r/web',
      CUCCUT_SLIDES_EDITOR_DIST: '/r/slides-editor',
      CUCCUT_DESIGN_EDITOR_DIST: '/r/design-editor',
      CUCCUT_DESIGN_SYSTEM_EDITOR_DIST: '/r/design-system-editor',
    });
  });
  it('pins macOS MLX to the shipped Metal library', () => {
    expect(packagedResourceEnv(packagedResources('/r'), 'darwin').PMETAL_METALLIB_PATH).toBe('/r/bin/mlx.metallib');
    expect(packagedResourceEnv(packagedResources('/r'), 'win32')).not.toHaveProperty('PMETAL_METALLIB_PATH');
  });
});
