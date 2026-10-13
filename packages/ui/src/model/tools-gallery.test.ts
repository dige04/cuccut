import { describe, expect, it } from 'vitest';
import type { ModelCapabilitiesView, PipelineInfo, ToolStatus } from '@cuccut/protocol';
import { fixtureView, textView, withLocalSpeech } from './models-test-fixtures.ts';
import { TOOLS } from './tool-catalog.ts';
import {
  linkReadyStatus,
  pipelineMissing,
  transcodeCardStatus,
  plannedReason,
  toolBlock,
  toolCardStatus,
  usableCloudCount,
} from './tools-gallery.ts';

function offline(view: ModelCapabilitiesView): ModelCapabilitiesView {
  const strip = <T extends { providers: { config: unknown; available: boolean }[] }>(c: T): T => ({
    ...c,
    providers: c.providers.map((p) => ({ ...p, config: { enabled: false, enabledAt: null, credential: 'missing' }, available: false })),
  });
  return {
    transcribe: strip(view.transcribe),
    synthesizeSpeech: strip(view.synthesizeSpeech),
    generateImage: strip(view.generateImage),
    generateText: strip(view.generateText),
    separateAudio: strip(view.separateAudio),
    generateMusic: strip(view.generateMusic),
  };
}

function status(patch: Partial<ToolStatus>): ToolStatus {
  return {
    id: 'translate-subtitles',
    label: '翻译字幕',
    description: '',
    category: 'speech',
    inputs: ['video', 'file'],
    results: ['video', 'artifact'],
    execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: 'translate' },
    executionByInput: { file: { kind: 'pipeline', method: 'pipelines.start', pipeline: 'translate-subtitles' } },
    capabilities: ['generateText'],
    optionalCapabilities: [],
    externalTools: [],
    optionalExternalTools: [],
    network: 'none',
    candidates: 'videos-with-transcript',
    available: true,
    problems: [],
    limitations: [],
    ...patch,
  };
}

const pipeline = (name: string): PipelineInfo => ({ name, label: name, description: '', steps: [], paramsSchema: {} });

describe('status line on the tools overview', () => {
  it('no \'coming soon\' tools in the catalog; compress, merge and extract audio are listed where they are confirmed usable', () => {
    expect(TOOLS.filter((t) => plannedReason(t.id)).map((t) => t.id)).toEqual([]);
    // Doesn't look at the cloud capability view: if the view hasn't arrived, the status is still written here; not written before tools.list arrives.
    expect(toolCardStatus('compress-video', null, null)).toEqual({ on: true, text: transcodeCardStatus() });
    expect(toolCardStatus('merge-video', null, null)).toEqual({ on: true, text: transcodeCardStatus() });
    expect(toolCardStatus('extract-audio', null, null)).toEqual({ on: true, text: transcodeCardStatus() });
    expect(toolCardStatus('compress-video', null)).toBeNull();
    // On the Web, the reasons (fixed flow not open, save location outside the project directory) come from tools.list; keep them as written.
    const web = 'Web 服务上不能调用 pipelines.start';
    expect(toolCardStatus('extract-audio', null, web)).toEqual({ on: false, text: web });
  });

  it('unavailable follows tools.list: writes the first reason and greys the item out', () => {
    const down = status({ available: false, problems: [{ code: 'CAPABILITY_NOT_CONFIGURED', message: '还没有配置文本生成模型', remedy: '到设置里连接' }] });
    expect(toolBlock(down, null)).toBe('还没有配置文本生成模型');
    expect(toolBlock(down, null, undefined, true)).toBe('还没有配置文本生成模型。到设置里连接');
    const same = '转写还没有可用的模型：安装本机模型包，或配置一个在线服务并设为默认。';
    const twice = status({ available: false, problems: [{ code: 'CAPABILITY_NOT_CONFIGURED', message: same, remedy: same }] });
    expect(toolBlock(twice, null, undefined, true)).toBe(same);
    const dotted = status({ available: false, problems: [{ code: 'X', message: '下载工具还没装。', remedy: '先在首页准备' }] });
    expect(toolBlock(dotted, null, undefined, true)).toBe('下载工具还没装。先在首页准备');
    expect(toolCardStatus('translate-subtitles', textView(), toolBlock(down, null))).toEqual({ on: false, text: '还没有配置文本生成模型' });
    expect(toolCardStatus('compress-video', null, 'ffmpeg 没装')).toEqual({ on: false, text: 'ffmpeg 没装' });
  });

  it('cannot be pressed when the pipeline that runs it is not in pipelines.list (finds the pipeline by input kind)', () => {
    const ok = status({});
    expect(toolBlock(ok, null)).toBeNull();
    expect(toolBlock(ok, [pipeline('translate')])).toBeNull();
    expect(toolBlock(ok, [pipeline('translate')], 'file')).toBe(pipelineMissing());
    expect(toolBlock(ok, [pipeline('translate'), pipeline('translate-subtitles')], 'file')).toBeNull();
    expect(toolBlock(status({ execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: 'transcribe' }, executionByInput: undefined }), [])).toBe(
      pipelineMissing(),
    );
    expect(toolBlock(null, [])).toBeNull();
  });

  it('import from link: writes download tool ready when confirmed usable, not written before the status arrives', () => {
    expect(toolCardStatus('link-import', null, null)).toEqual({ on: true, text: linkReadyStatus() });
    expect(toolCardStatus('link-import', null)).toBeNull();
    expect(toolCardStatus('transcribe', fixtureView(), null)).toBeNull();
  });

  it('download tool ready but transcription model missing: only download is usable, download and transcribe shows the reason and fix; blocker cleared once the model is ready', () => {
    const download = status({
      id: 'link-import',
      execution: { kind: 'pipeline', method: 'pipelines.start', pipeline: 'link-import' },
      optionalCapabilities: ['transcribe'],
      limitations: [{ code: 'CAPABILITY_NOT_CONFIGURED', capability: 'transcribe', message: '转录模型尚未安装', remedy: '先安装模型' }],
    });
    const pipelines = [pipeline('link-import')];
    expect(toolBlock(download, pipelines, 'link')).toBeNull();
    expect(toolBlock(download, pipelines, 'link', true, ['transcribe'])).toBe('转录模型尚未安装。先安装模型');
    expect(toolBlock({ ...download, limitations: [] }, pipelines, 'link', true, ['transcribe'])).toBeNull();
    expect(toolBlock(download, pipelines, 'link', true, ['synthesizeSpeech'])).toBeNull();
  });

  it('text generation counts usable cloud providers', () => {
    // OpenAI is connected; Google is not.
    expect(usableCloudCount(textView(), 'generateText')).toBe(1);
    expect(toolCardStatus('generate-text', textView())).toEqual({ on: true, text: '1 家云端已连接' });
    // Also state it clearly when there is no text provider at all (the Runtime hasn't listed any yet).
    expect(toolCardStatus('generate-text', fixtureView())).toEqual({ on: false, text: '还没有可用的文本模型' });
  });

  it('speech and image generation count usable cloud providers: connected, and this tier also usable', () => {
    const view = fixtureView();
    // OpenAI, and a TTS Box that declares a speech synthesis model; an ASR Box that is connected but has no model at this tier doesn't count.
    expect(usableCloudCount(view, 'synthesizeSpeech')).toBe(2);
    expect(toolCardStatus('synthesize-speech', view)).toEqual({ on: true, text: '2 家云端已连接' });
    // Codex image generation is an agent provider, so it doesn't count as cloud.
    expect(toolCardStatus('generate-image', view)).toEqual({ on: true, text: '1 家云端已连接' });
  });

  it('speech generation also counts installed local models', () => {
    expect(toolCardStatus('synthesize-speech', withLocalSpeech())).toEqual({ on: true, text: '本机 1 个模型 · 2 家云端已连接' });
    expect(toolCardStatus('synthesize-speech', withLocalSpeech(offline(fixtureView())))).toEqual({ on: true, text: '本机 1 个模型' });
  });

  it('says clearly when nothing is connected', () => {
    const view = offline(fixtureView());
    expect(toolCardStatus('synthesize-speech', view)).toEqual({ on: false, text: '还没有可用的语音合成模型' });
    expect(toolCardStatus('generate-image', view)).toEqual({ on: false, text: '还没有可用的生图模型' });
    expect(toolCardStatus('generate-text', offline(textView()))).toEqual({ on: false, text: '还没有可用的文本模型' });
  });

  it('no status line while the capability view has not arrived', () => {
    expect(toolCardStatus('synthesize-speech', null)).toBeNull();
    expect(toolCardStatus('generate-image', null)).toBeNull();
    expect(toolCardStatus('generate-text', null)).toBeNull();
  });
});
