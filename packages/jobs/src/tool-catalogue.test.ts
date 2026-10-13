import { describe, expect, it } from 'vitest';
import { MODEL_SERVICE_CAPABILITIES, TOOL_CATEGORIES, TOOL_INPUT_KINDS } from '@cuccut/protocol';
import { TOOL_CATALOGUE, TRANSCRIBE_PIPELINE, toolDefinition } from './tool-catalogue.ts';
import { DUB_PIPELINE } from './pipelines/dub.ts';
import { LINK_IMPORT_PIPELINE } from './pipelines/link-import.ts';
import { TRANSCODE_PIPELINE } from './pipelines/transcode.ts';
import { TRANSLATE_PIPELINE } from './pipelines/translate.ts';
import { TRANSLATE_SUBTITLES_PIPELINE } from './pipelines/translate-subtitles.ts';

/** Static registry of the tool catalogue (architecture design §7.9): the first batch of tools, complete declarations, stable IDs. */

describe('tool catalogue', () => {
  it('ten tools are grouped, with unique lowercase hyphenated IDs', () => {
    expect(TOOL_CATALOGUE.map((t) => t.id)).toEqual([
      'transcribe',
      'translate-subtitles',
      'dub',
      'synthesize-speech',
      'generate-text',
      'generate-image',
      'generate-music',
      'link-import',
      'compress-video',
      'merge-video',
      'extract-audio',
    ]);
    for (const tool of TOOL_CATALOGUE) {
      expect(tool.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(tool.label).not.toBe('');
      expect(TOOL_CATEGORIES).toContain(tool.category);
      expect(tool.inputs.length).toBeGreaterThan(0);
      for (const input of tool.inputs) expect(TOOL_INPUT_KINDS).toContain(input);
      expect(tool.results.length).toBeGreaterThan(0);
      for (const capability of [...tool.capabilities, ...tool.optionalCapabilities])
        expect(MODEL_SERVICE_CAPABILITIES).toContain(capability);
      // A capability cannot be both required and optional.
      expect(tool.capabilities.filter((c) => tool.optionalCapabilities.includes(c))).toEqual([]);
      // When execution is switched by input, that input must be listed in inputs.
      for (const input of Object.keys(tool.executionByInput ?? {})) expect(tool.inputs).toContain(input);
      // Only tools that accept video input have candidate rules.
      expect(tool.candidates !== null).toBe(tool.inputs.includes('video'));
    }
  });

  it('each tool maps to one pipeline or one direct task, and dependencies are declared accurately', () => {
    expect(toolDefinition('transcribe')).toMatchObject({
      execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: TRANSCRIBE_PIPELINE },
      inputs: ['file', 'video'],
      // With only a file given, the result is the TXT and SRT in the save location.
      results: ['artifact', 'video'],
      capabilities: ['transcribe'],
      externalTools: [],
      optionalExternalTools: [],
      network: 'none',
      candidates: 'videos',
    });
    expect(TRANSCRIBE_PIPELINE).toBe('transcribe');
    // Two ways to translate subtitles: the transcript in a video is written as a new translation; a subtitle file is translated into a new subtitle file (file to file).
    expect(toolDefinition('translate-subtitles')).toMatchObject({
      inputs: ['video', 'document', 'file'],
      results: ['video', 'artifact'],
      execution: { pipeline: TRANSLATE_PIPELINE, params: { captions: true } },
      executionByInput: { file: { kind: 'pipeline', method: 'pipelines.start', pipeline: TRANSLATE_SUBTITLES_PIPELINE } },
      capabilities: ['generateText'],
      candidates: 'videos-with-transcript',
    });
    expect(toolDefinition('dub')).toMatchObject({
      execution: { pipeline: DUB_PIPELINE },
      capabilities: ['synthesizeSpeech'],
      optionalCapabilities: ['generateText'],
      externalTools: ['ffmpeg'],
      candidates: 'videos-with-transcript',
    });
    expect(toolDefinition('link-import')).toMatchObject({
      execution: { pipeline: LINK_IMPORT_PIPELINE },
      externalTools: ['yt-dlp'],
      network: 'required',
      results: ['artifact'],
    });
    expect(toolDefinition('compress-video')).toMatchObject({
      execution: { pipeline: TRANSCODE_PIPELINE, params: { action: 'compress' } },
      externalTools: ['ffmpeg'],
      candidates: null,
    });
    expect(toolDefinition('extract-audio')).toMatchObject({
      label: '提取音频',
      category: 'video-file',
      inputs: ['file'],
      results: ['artifact'],
      execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: TRANSCODE_PIPELINE, params: { action: 'extract-audio' } },
      externalTools: ['ffmpeg'],
      candidates: null,
    });
    expect(toolDefinition('merge-video')).toMatchObject({ execution: { pipeline: TRANSCODE_PIPELINE, params: { action: 'merge' } } });
    // Documents and subtitle entries in Space are used as material via `material` (§7.9).
    expect(toolDefinition('synthesize-speech')).toMatchObject({
      category: 'speech',
      inputs: ['text', 'document'],
      results: ['artifact'],
      execution: { kind: 'job', method: 'models.synthesizeSpeech', capability: 'synthesizeSpeech' },
    });
    expect(toolDefinition('generate-image')?.execution).toEqual({
      kind: 'job',
      method: 'models.generateImage',
      capability: 'generateImage',
    });
    expect(toolDefinition('generate-text')?.execution).toEqual({ kind: 'job', method: 'models.generateText', capability: 'generateText' });
    expect(toolDefinition('generate-music')).toMatchObject({
      category: 'music',
      inputs: ['text'],
      results: ['artifact'],
      execution: { kind: 'job', method: 'models.generateMusic', capability: 'generateMusic' },
      capabilities: ['generateMusic'],
    });
    expect(toolDefinition('generate-text')?.inputs).toEqual(['text', 'document']);
    expect(toolDefinition('nope')).toBeNull();
  });

  it('split into four groups: speech and subtitles, text and images, music, video files (§7.9, product design §2.7)', () => {
    const groups = Object.fromEntries(TOOL_CATEGORIES.map((c) => [c, TOOL_CATALOGUE.filter((t) => t.category === c).map((t) => t.id)]));
    expect(groups).toEqual({
      speech: ['transcribe', 'translate-subtitles', 'dub', 'synthesize-speech'],
      'text-image': ['generate-text', 'generate-image'],
      music: ['generate-music'],
      'video-file': ['link-import', 'compress-video', 'merge-video', 'extract-audio'],
    });
  });
});
