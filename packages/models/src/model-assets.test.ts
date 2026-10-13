import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { MODEL_ASSETS_ENV, modelAssetPath, resolveModelAssetsDir } from './model-assets.ts';
import { TRANSCRIBE_SELF_TEST, selfTestSampleFile } from './self-test-sample.ts';
import { BUILTIN_VOICES, builtinVoiceFile } from './speech-voices.ts';

const SOURCE_ASSETS = fileURLToPath(new URL('../assets', import.meta.url));

describe('model data shipped with the app', () => {
  const temps: string[] = [];
  const process_ = process as { resourcesPath?: string };
  const originalResources = process_.resourcesPath;

  afterEach(() => {
    if (originalResources === undefined) delete process_.resourcesPath;
    else process_.resourcesPath = originalResources;
    for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  function temp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-model-assets-'));
    temps.push(dir);
    return dir;
  }

  it('source layout: walking up from the module finds packages/models/assets in the repository', () => {
    expect(resolveModelAssetsDir({})).toBe(SOURCE_ASSETS);
  });

  it('self-test samples and every built-in voice recording in the directory resolve to existing files', () => {
    const sample = selfTestSampleFile(TRANSCRIBE_SELF_TEST, {});
    expect(sample).toBe(path.join(SOURCE_ASSETS, 'self-test-sample.wav'));
    expect(fs.statSync(sample!).isFile()).toBe(true);
    expect(BUILTIN_VOICES.length).toBeGreaterThan(0);
    for (const voice of BUILTIN_VOICES) {
      const file = builtinVoiceFile(voice, {});
      expect(file, voice.id).not.toBeNull();
      expect(fs.statSync(file!).isFile(), voice.id).toBe(true);
    }
  });

  it('environment variables take precedence and are read at call time; when a file is missing from the directory the path is still returned, and the reader reports the absence', () => {
    const dir = temp();
    const env = { [MODEL_ASSETS_ENV]: dir };
    expect(resolveModelAssetsDir(env)).toBe(dir);
    expect(modelAssetPath('tts-voices/zh-female.wav', env)).toBe(path.join(dir, 'tts-voices', 'zh-female.wav'));
    expect(fs.existsSync(selfTestSampleFile(TRANSCRIBE_SELF_TEST, env)!)).toBe(false);
  });

  it('packaged app: model-assets in the resources directory take precedence over the repository', () => {
    const resources = temp();
    process_.resourcesPath = resources;
    expect(resolveModelAssetsDir({})).toBe(SOURCE_ASSETS);
    fs.mkdirSync(path.join(resources, 'model-assets'));
    expect(resolveModelAssetsDir({})).toBe(path.join(resources, 'model-assets'));
  });
});
