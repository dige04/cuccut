import { describe, expect, it } from 'vitest';
import type { JobRecord, ModelBundleStatus, PipelineStepState, ProposedSpeaker, Sequence, VideoItem } from '@cuccut/protocol';
import {
  changedNames,
  clipLabel,
  clipWindow,
  clockText,
  diarizePack,
  durationText,
  nameProblem,
  speakersReceiptText,
  speakersStage,
} from './speakers-proposal.ts';

const speaker = (id: string, name: string): ProposedSpeaker => ({ id, name, isNew: false, words: 1, seconds: 1, sentences: 1, clips: [] });

describe('speaker identification', () => {
  it('audition clip: media time plus the start of a sentence; long ones are truncated', () => {
    expect(clockText(0)).toBe('00:00');
    expect(clockText(74.9)).toBe('01:14');
    expect(clockText(3725)).toBe('1:02:05');
    expect(clipLabel({ sentenceId: 's', start: 14_000, end: 16_000, text: '先从一个简单的例子讲起' }, 1000)).toBe(
      '00:14 · 先从一个简单的例…',
    );
    expect(clipLabel({ sentenceId: 's', start: 0, end: 1, text: '  大家好 ' }, 1000)).toBe('00:00 · 大家好');
  });

  it('clip is projected onto the timeline; cut-away parts do not get a range', () => {
    const item = {
      id: 'clip',
      trackId: 'v1',
      type: 'video',
      span: { fromFrame: 30, durationFrames: 60 },
      assetRef: { id: 'asset', revision: '1' },
      timeMap: { kind: 'linear', sourceIn: { ticks: '2000', timescale: 1000 }, rate: { num: 1, den: 1 } },
    } as unknown as VideoItem;
    const sequence = { fps: { num: 30, den: 1 }, items: [item] } as unknown as Sequence;
    // Material from 2s onward is placed at 1s on the timeline.
    expect(clipWindow(sequence, 'asset', { sentenceId: 's', start: 2500, end: 3000, text: 'x' }, 1000)).toEqual({ start: 1.5, end: 2 });
    expect(clipWindow(sequence, 'asset', { sentenceId: 's', start: 0, end: 1000, text: 'x' }, 1000)).toBeNull();
    expect(clipWindow(sequence, 'other', { sentenceId: 's', start: 2500, end: 3000, text: 'x' }, 1000)).toBeNull();
  });

  it('which stage is running: decoding and voiceprints, clustering, organizing', () => {
    const steps = (diarize: PipelineStepState['status'], propose: PipelineStepState['status']) =>
      [
        { name: 'diarize', label: '', status: diarize, jobId: 'c1', attempts: 1, output: null },
        { name: 'propose', label: '', status: propose, jobId: null, attempts: 0, output: null },
      ] as PipelineStepState[];
    const parent = (s: PipelineStepState[]) => ({ jobId: 'p', pipeline: { steps: s } }) as unknown as JobRecord;
    const child = (phase: JobRecord['phase']) => ({ jobId: 'c1', phase }) as JobRecord;
    expect(speakersStage(null, [])).toBe(0);
    expect(speakersStage(parent(steps('running', 'pending')), [child('decoding')])).toBe(0);
    expect(speakersStage(parent(steps('running', 'pending')), [child('diarizing')])).toBe(1);
    expect(speakersStage(parent(steps('completed', 'running')), [child('done')])).toBe(2);
  });

  it('renaming: empty or overlong names are rejected; the submission only includes changed names', () => {
    expect(nameProblem('  ')).toBe('名字不能为空');
    expect(nameProblem('x'.repeat(101))).toBe('名字最多 100 个字');
    expect(nameProblem('嘉宾')).toBeNull();
    const speakers = [speaker('a', '说话人 1'), speaker('b', '说话人 2')];
    expect(changedNames(speakers, {})).toBeUndefined();
    expect(changedNames(speakers, { a: ' 说话人 1 ', b: ' 嘉宾 ' })).toEqual({ b: '嘉宾' });
  });

  it('receipts and elapsed time', () => {
    expect(durationText(9200)).toBe('9.2s');
    expect(durationText(65_000)).toBe('1m 5s');
    expect(
      speakersReceiptText({ speakers: [speaker('a', 'x'), speaker('b', 'y'), speaker('c', 'z')], diarizeMs: 9200 }, '本机声纹模型'),
    ).toBe('已应用 · 识别出 3 位说话人 · 9.2s · 本机声纹模型');
  });

  it('only recognizes the \'speaker diarization\' model pack', () => {
    const bundles = [
      { bundleId: 'qwen3-asr@mlx', capability: 'transcribe' },
      { bundleId: 'speaker-diarization@mlx', capability: 'diarize' },
    ] as ModelBundleStatus[];
    expect(diarizePack(bundles)?.bundleId).toBe('speaker-diarization@mlx');
    expect(diarizePack([])).toBeNull();
  });
});
