import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_LABELS,
  INPUT_LABELS,
  TOOL_GROUPS,
  TOOLS,
  artifactText,
  inputOptions,
  isFileVideoTool,
  isVideoTool,
  openable,
  outputOf,
  resultLine,
  spaceKindsOf,
  targetOptions,
  toolById,
  toolIdOf,
} from './tool-catalog.ts';

/* Cases from design file model-tools.test.js, lines 19–64, with the tool IDs replaced by the IDs in the Runtime registry. */

describe('tool catalog', () => {
  it('groups into four by what they process: speech and subtitles, text and images, music, video files (product design §2.7, the order of `TOOL_CATEGORIES`)', () => {
    expect(TOOL_GROUPS.map((g) => [g.key, g.label])).toEqual([
      ['speech', '语音与字幕'],
      ['text-image', '文字与图片'],
      ['music', '音乐'],
      ['video-file', '视频文件'],
    ]);
    expect(TOOL_GROUPS[0]!.tools.map((t) => t.id)).toEqual(['transcribe', 'translate-subtitles', 'dub', 'synthesize-speech']);
    expect(TOOL_GROUPS[1]!.tools.map((t) => t.id)).toEqual(['generate-text', 'generate-image']);
    expect(TOOL_GROUPS[2]!.tools.map((t) => t.id)).toEqual(['generate-music']);
    expect(TOOL_GROUPS[3]!.tools.map((t) => t.id)).toEqual(['link-import', 'compress-video', 'merge-video', 'extract-audio']);
    expect(TOOL_GROUPS.every((g) => g.desc.length > 0)).toBe(true);
    expect(openable('link-import')?.name).toBe('下载视频');
    expect(openable('transcribe')?.group).toBe('speech');
    expect(openable('dub')?.name).toBe('翻译配音');
    expect(openable('generate-text')?.group).toBe('text-image');
    expect(openable('extract-audio')?.name).toBe('提取音频');
    expect(openable('extract-audio')?.group).toBe('video-file');
    expect(openable('remote')).toBeNull();
    expect(openable('merge-video')?.name).toBe('合并视频');
    expect(openable('nope')).toBeNull();
    expect(TOOLS.some((t) => t.planned)).toBe(false);
    for (const t of TOOLS) {
      expect(['video', 'artifact']).toContain(t.output);
      expect(t.inputs.length).toBeGreaterThan(0);
      for (const i of t.inputs) {
        expect(INPUT_LABELS[i.kind]).toBeTruthy();
        expect(['video', 'artifact']).toContain(i.output);
      }
      for (const a of t.artifacts) expect(ARTIFACT_LABELS[a]).toBeTruthy();
      // Tools that only write into the video (dubbing translation) produce no items; all others produce items in Space by default.
      if (t.output === 'video') expect(t.artifacts).toEqual([]);
      else expect(t.artifacts.length).toBeGreaterThan(0);
    }
  });

  it('legacy short names resolve to registry IDs; unknown ones are not recognized', () => {
    expect(toolIdOf('translate')).toBe('translate-subtitles');
    expect(toolIdOf('link')).toBe('link-import');
    expect(toolIdOf('tts')).toBe('synthesize-speech');
    expect(toolIdOf('image')).toBe('generate-image');
    expect(toolIdOf('text')).toBe('generate-text');
    expect(toolIdOf('compress')).toBe('compress-video');
    expect(toolIdOf('merge')).toBe('merge-video');
    expect(toolIdOf('extract')).toBe('extract-audio');
    expect(toolIdOf('transcribe')).toBe('transcribe');
    expect(toolIdOf('constructor')).toBeNull();
    expect(toolIdOf('')).toBeNull();
    expect(toolIdOf(undefined)).toBeNull();
    expect(toolById('tts')?.id).toBe('synthesize-speech');
    expect(isVideoTool('dub')).toBe(true);
    expect(isVideoTool('generate-text')).toBe(false);
    // “Video tools” are a page mechanism (video picker, run page), independent of grouping: downloading a video is in the video files group, and it is still a video tool.
    expect(isVideoTool('link-import')).toBe(true);
    expect(isVideoTool('extract-audio')).toBe(false);
    expect(['compress-video', 'merge-video', 'extract-audio'].every((id) => isFileVideoTool(id as 'extract-audio'))).toBe(true);
    expect(isFileVideoTool('transcribe')).toBe(false);
  });

  it('input sources and results derive from declarations: transcription picks one of three (links are executed by import from link), translating subtitles from a file input yields an artifact', () => {
    expect(inputOptions('transcribe').map((o) => o.label)).toEqual(['本机文件', '资料库', '链接']);
    expect(inputOptions('transcribe').map((o) => o.via)).toEqual([null, null, 'link-import']);
    expect(inputOptions('translate-subtitles').map((o) => [o.key, o.label, o.output])).toEqual([
      ['space', '资料库', 'artifact'],
      ['file', '本机字幕文件', 'artifact'],
    ]);
    expect(inputOptions('translate-subtitles')[0]!.needs).toBe('transcript');
    expect(inputOptions('translate-subtitles')[1]!.accept).toEqual(['.srt', '.vtt']);
    expect(inputOptions('dub').map((o) => o.key)).toEqual(['video']);
    expect(outputOf('transcribe', 'link')).toBe('artifact');
    expect(inputOptions('synthesize-speech').map((o) => o.key)).toEqual(['text', 'space']);
    // Text-generation items in Space are incidental material, not another source: they are not part of the switch, but the kinds they accept still count.
    expect(inputOptions('generate-text').map((o) => o.key)).toEqual(['text']);
    expect(spaceKindsOf('generate-text')).toEqual(['document', 'subtitle']);
    expect(spaceKindsOf('extract-audio')).toEqual(['video-file', 'export', 'audio']);
    expect(spaceKindsOf('generate-image')).toEqual([]);
    expect(outputOf('translate-subtitles', 'file')).toBe('artifact');
    expect(outputOf('dub', 'file')).toBeNull();
    expect(inputOptions('nope')).toEqual([]);
    expect(resultLine('transcribe')).toBe('结果：资料库里的文档与字幕条目；也可以新建视频；选可编辑的视频时写进它');
    expect(resultLine('translate-subtitles')).toBe('结果：资料库里的字幕条目；选可编辑的视频时写进它');
    expect(resultLine('dub')).toBe('结果：写进你选的视频');
    expect(resultLine('synthesize-speech')).toBe('结果：资料库里的音频条目');
    expect(resultLine('extract-audio')).toBe('结果：资料库里的音频条目');
    expect(artifactText([])).toBe('产物条目');
    expect(resultLine('nope')).toBe('');
  });

  it('download video: a link input yields a file and needs no video target', () => {
    expect(inputOptions('link-import').map((o) => [o.key, o.output])).toEqual([['link', 'artifact']]);
    expect(outputOf('link-import', 'link')).toBe('artifact');
    expect(targetOptions('link-import')).toEqual([]);
    expect(resultLine('link-import')).toContain('视频文件');
  });
});
