import { describe, expect, it } from 'vitest';
import type { JobRecord, SpaceEntry } from '@cuccut/protocol';
import { entryLocation, rerunOf, toolOfOrigin, toolOfTask, toolsForEntry } from './tool-rerun.ts';

type JobLike = Pick<JobRecord, 'kind' | 'pipeline' | 'submitter' | 'videoId' | 'state'>;

const job = (patch: Partial<JobLike> = {}): JobLike => ({
  kind: 'synthesizeSpeech',
  pipeline: undefined,
  submitter: { kind: 'connection' } as JobRecord['submitter'],
  videoId: null,
  state: 'completed',
  ...patch,
});

const pipeline = (name: string, params: Record<string, unknown> = {}) =>
  ({ kind: 'pipeline', pipeline: { name, params } }) as unknown as Partial<JobLike>;

const entry = (patch: Partial<SpaceEntry> = {}, trashedAt: string | null = null): SpaceEntry => ({
  id: 'e1',
  kind: 'subtitle',
  name: 'talk.srt',
  fileName: 'talk.srt',
  source: { projectId: null, conversationId: null },
  relPath: 'talk.srt',
  size: 2048,
  lastActivityAt: '2026-10-01T00:00:00.000Z',
  status: null,
  file: { path: '/Users/me/Movies/CucCut/talk.srt' },
  ...patch,
  user: { favorite: false, displayName: null, trashedAt },
});

describe('which tool a task belongs to', () => {
  it('direct tasks and workflows from tool pages; those started by the agent or the editor panel don\'t count', () => {
    expect(toolOfTask(job())).toBe('synthesize-speech');
    expect(toolOfTask(job({ kind: 'generateImage' }))).toBe('generate-image');
    expect(toolOfTask(job({ kind: 'generateText' }))).toBe('generate-text');
    expect(toolOfTask(job(pipeline('translate-subtitles')))).toBe('translate-subtitles');
    expect(toolOfTask(job({ submitter: { kind: 'agent' } as JobRecord['submitter'] }))).toBeNull();
    expect(toolOfTask(job({ videoId: 'v1' }))).toBeNull();
  });

  it('inferred from task kind or workflow name only when there is an item source; those done in a session, and transcodes that can\'t be told apart, don\'t count', () => {
    expect(toolOfOrigin({ capability: 'generateImage', conversationId: undefined })).toBe('generate-image');
    expect(toolOfOrigin({ capability: 'transcribe', conversationId: undefined })).toBe('transcribe');
    expect(toolOfOrigin({ capability: 'transcode', conversationId: undefined })).toBeNull();
    expect(toolOfOrigin({ capability: 'synthesizeSpeech', conversationId: 'c1' })).toBeNull();
    expect(toolOfOrigin(undefined)).toBeNull();
  });
});

describe('retry and run again', () => {
  it('a direct task returns to the filled form: failed or interrupted is called "重试", completed is called "再做一次"', () => {
    expect(rerunOf(job({ state: 'failed' }))).toEqual({ tool: 'synthesize-speech', label: '重试', mode: 'refill' });
    expect(rerunOf(job({ state: 'interrupted' }))?.label).toBe('重试');
    expect(rerunOf(job())).toEqual({ tool: 'synthesize-speech', label: '再做一次', mode: 'refill' });
  });

  it('video tools open this run; running, queued, awaiting reconciliation, and non-tool-page runs are not offered', () => {
    expect(rerunOf(job({ ...pipeline('dub'), state: 'failed' }))).toEqual({ tool: 'dub', label: '再做一次', mode: 'view' });
    expect(rerunOf(job({ state: 'running' }))).toBeNull();
    expect(rerunOf(job({ state: 'queued' }))).toBeNull();
    expect(rerunOf(job({ state: 'needs-reconciliation' }))).toBeNull();
    expect(rerunOf(job({ videoId: 'v1', state: 'failed' }))).toBeNull();
  });
});

describe('process an item with a tool', () => {
  it('lists tools that accept this kind of item; trash, generating, failed, and missing-file items are not listed', () => {
    expect(toolsForEntry(entry()).map((t) => t.id)).toEqual(['translate-subtitles', 'synthesize-speech', 'generate-text']);
    expect(toolsForEntry(entry({ kind: 'audio' })).map((t) => t.id)).toEqual(['transcribe', 'extract-audio']);
    expect(toolsForEntry(entry({ kind: 'image' }))).toEqual([]);
    expect(toolsForEntry(entry({}, '2026-10-02T00:00:00.000Z'))).toEqual([]);
    for (const status of ['generating', 'failed', 'missing'] as const) expect(toolsForEntry(entry({ status }))).toEqual([]);
  });

  it('the item\'s folder, marked whether it is the default save location; videos and items without a path are not offered', () => {
    expect(entryLocation(entry(), '/Users/me/Movies/CucCut/')).toEqual({ label: '~/Movies/CucCut', isSaveDir: true });
    expect(entryLocation(entry(), '/Users/me/Desktop')).toEqual({ label: '~/Movies/CucCut', isSaveDir: false });
    expect(entryLocation(entry(), null)?.isSaveDir).toBe(false);
    expect(entryLocation(entry({ kind: 'video' }), null)).toBeNull();
    expect(entryLocation(entry({ file: undefined }), null)).toBeNull();
  });
});
