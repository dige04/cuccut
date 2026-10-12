import { describe, expect, it } from 'vitest';
import {
  AUDIO_CPP_COMMAND,
  AUDIO_CPP_ENGINE_COMPONENT,
  AUDIO_CPP_RELEASE,
  AUDIO_CPP_TOOL,
  parseAudioCppVersion,
} from './music-engine.ts';

/** audio.cpp 引擎的发布登记（架构设计 §6.3）：每个登记的平台都有完整的摘要与大小，格式、文件名与可执行文件一致。 */
describe('audio.cpp engine release', () => {
  it('pins one archive per supported platform with a full digest', () => {
    expect(AUDIO_CPP_TOOL).toBe('audiocpp');
    expect(AUDIO_CPP_COMMAND).toBe('audiocpp_cli');
    expect(Object.keys(AUDIO_CPP_RELEASE.assets).sort()).toEqual(['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64']);
    for (const asset of Object.values(AUDIO_CPP_RELEASE.assets).filter((a) => a !== undefined)) {
      expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(asset.size).toBeGreaterThan(1024 * 1024);
      expect(asset.fileName).toContain(`v${AUDIO_CPP_RELEASE.version}`);
      expect(asset.fileName.endsWith(asset.archive.format === 'zip' ? '.zip' : '.tar.gz')).toBe(true);
      expect(asset.executable).toBe(asset.archive.format === 'zip' ? 'audiocpp_cli.exe' : 'audiocpp_cli');
      expect(asset.archive.skip).not.toContain(asset.executable);
    }
    expect(AUDIO_CPP_RELEASE.assets['win32-x64']!.archive.skip).toEqual(['audiocpp_server.exe', 'audiocpp_gguf.exe']);
    expect(AUDIO_CPP_RELEASE.urlTemplate).toBe('https://github.com/0xShug0/audio.cpp/releases/download/v{version}/{file}');
  });

  it('is a model bundle component with a synthetic repo, the release tag and an Apache-2.0 license', () => {
    expect(AUDIO_CPP_ENGINE_COMPONENT).toMatchObject({
      family: 'audio-cpp-engine',
      repo: '0xShug0/audio.cpp',
      revision: `v${AUDIO_CPP_RELEASE.version}`,
      license: { name: 'Apache-2.0', commercialUse: true },
    });
    expect(AUDIO_CPP_ENGINE_COMPONENT.release).toBe(AUDIO_CPP_RELEASE);
    expect(AUDIO_CPP_ENGINE_COMPONENT.license!.summary).toBeTruthy();
  });

  it('reads the version from --version output', () => {
    const output = 'audio.cpp 0.9.1\ngit: cf124a67 2026-10-07\nbuild: Release, apple-clang 21.0.0, Darwin arm64\nbackends: cpu,metal\n';
    expect(parseAudioCppVersion(output)).toBe('0.9.1');
    expect(parseAudioCppVersion('audio.cpp dev\n')).toBe('dev');
    expect(parseAudioCppVersion('audio.cpp v1.0.0')).toBe('1.0.0');
    expect(parseAudioCppVersion('usage: audiocpp_cli --task …')).toBeNull();
  });
});
