import { describe, expect, it } from 'vitest';
import type { JobRecord, ToolCandidate, ToolCandidateDocument } from '@cuccut/protocol';
import {
  blockReason,
  defaultTargetLang,
  documentsByEntry,
  duplicateNote,
  eligibleCount,
  langsText,
  pick,
  pickerRows,
  sourceDocument,
  failedTranscribeJob,
  newVideoName,
  replaceImpact,
  retargetOptions,
  retryParamsOf,
  spaceTranscribeAction,
  tagsOf,
  targetLangs,
  transcribeState,
  translationOptions,
} from './tool-targets.ts';

/* Idea from the design draft model-tool-targets.test.js: selectable items first, disabled items give a reason, labels and the "does not overwrite“copy N” numbering for translations. */

function doc(patch: Partial<ToolCandidateDocument> = {}): ToolCandidateDocument {
  return {
    kind: 'speech',
    documentId: 'doc_zh',
    name: '文稿',
    language: 'zh',
    wordTiming: true,
    onTimeline: true,
    translations: [],
    dubs: [],
    ...patch,
  };
}

function candidate(patch: Partial<ToolCandidate> = {}): ToolCandidate {
  return {
    entryId: 'ent_1',
    videoId: 'vid_1',
    name: '访谈第一集',
    projectId: 'prj_1',
    lastActivityAt: '2026-10-01T00:00:00Z',
    indexed: true,
    indexedRevision: 'r3',
    documents: [],
    ...patch,
  };
}

function job(patch: Partial<JobRecord>): JobRecord {
  return {
    jobId: 'job_1',
    kind: 'transcribe',
    state: 'running',
    phase: null,
    progress: null,
    videoId: 'vid_1',
    assetId: null,
    assetRevision: null,
    contentHash: '',
    providerId: 'local',
    modelId: 'whisper',
    bundleId: null,
    inputHash: '',
    submitter: { kind: 'connection', id: 'app' },
    attempt: 1,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    startedAt: null,
    endedAt: null,
    error: null,
    result: null,
    warnings: [],
    ...patch,
  } as JobRecord;
}

describe('video picker candidate rows', () => {
  it('language is written as its Chinese name, multiple copies of the same kind are marked ×N', () => {
    expect(langsText(['en', 'en', 'ja'])).toBe('英语 ×2、日语');
    expect(langsText([null])).toBe('未知语言');
  });

  it('badges: one each for script / translation / dub', () => {
    const tags = tagsOf([
      doc({
        translations: [{ documentId: 'tr_en', language: 'en', units: 10, staleUnits: 0 }],
        dubs: [{ groupId: 'g1', language: 'en', translationId: 'tr_en' }],
      }),
    ]);
    expect(tags.map((t) => t.label)).toEqual(['文稿 · 中文', '译文 · 英语', '配音 · 英语']);
    expect(tagsOf([])).toEqual([]);
  });

  it('transcription status is derived from jobs: running, queued, most recent failure; a failure followed by a later success doesn\'t count', () => {
    expect(transcribeState('vid_1', [job({ state: 'running' })])).toBe('running');
    expect(transcribeState('vid_1', [job({ state: 'queued' })])).toBe('queued');
    expect(transcribeState('vid_1', [job({ kind: 'pipeline', pipeline: { name: 'transcribe' } as JobRecord['pipeline'], state: 'running' })])).toBe('running');
    expect(transcribeState('vid_1', [job({ state: 'failed' })])).toBe('failed');
    expect(
      transcribeState('vid_1', [
        job({ jobId: 'a', state: 'failed', updatedAt: '2026-10-01T00:00:00Z' }),
        job({ jobId: 'b', state: 'completed', updatedAt: '2026-10-02T00:00:00Z' }),
      ]),
    ).toBeNull();
    expect(transcribeState('vid_2', [job({ state: 'running' })])).toBeNull();
    expect(transcribeState(null, [job({ state: 'running' })])).toBeNull();
  });

  it('greyed-out reasons: transcription only blocks what\'s currently being transcribed; tools needing a script explain by transcription status; link imports are always selectable', () => {
    const none = { documents: [], indexed: true };
    expect(blockReason('transcribe', none, null)).toBeNull();
    expect(blockReason('transcribe', none, 'running')).toBe('正在转录，完成后可以重新转录');
    expect(blockReason('transcribe', none, 'queued')).toBe('已在转录队列里');
    expect(blockReason('translate-subtitles', none, 'running')).toBe('正在转录，完成后才能选');
    expect(blockReason('dub', none, 'queued')).toBe('在转录队列里，转录完成后才能选');
    expect(blockReason('dub', none, 'failed')).toBe('上次转录失败，先重新转录');
    expect(blockReason('dub', none, null)).toBe('还没有文稿，先转录');
    expect(blockReason('dub', { documents: [], indexed: false }, null)).toBeNull();
    expect(blockReason('dub', { documents: [doc()], indexed: true }, 'failed')).toBeNull();
    expect(blockReason('link-import', none, 'running')).toBeNull();
  });

  it('selectable ones first, the same group keeps the Runtime order; search by name; preselection', () => {
    const list = [
      candidate({ entryId: 'a', videoId: 'va', name: '片花', documents: [] }),
      candidate({ entryId: 'b', videoId: 'vb', name: '访谈第一集', documents: [doc()] }),
      candidate({ entryId: 'c', videoId: 'vc', name: '访谈第二集', indexed: false, documents: [] }),
    ];
    const rows = pickerRows('translate-subtitles', list, []);
    expect(rows.map((r) => [r.entryId, r.eligible])).toEqual([
      ['b', true],
      ['c', true],
      ['a', false],
    ]);
    expect(rows[1]!.tags.map((t) => t.key)).toEqual(['pending']);
    expect(eligibleCount(rows)).toBe(2);
    expect(pickerRows('translate-subtitles', list, [], '访谈').map((r) => r.entryId)).toEqual(['b', 'c']);
    expect(pickerRows('translate-subtitles', list, [], '  片花 ').map((r) => r.entryId)).toEqual(['a']);
    expect(pick(rows, 'c')).toBe('c');
    expect(pick(rows, 'a')).toBe('b');
    expect(pick(rows, null)).toBe('b');
    expect(pick(pickerRows('dub', [list[0]!], []), null)).toBeNull();
  });

  it('transcription candidates don\'t list scripts: candidates with script rules supply the badges and the no-overwrite hint', () => {
    const extra = documentsByEntry([candidate({ entryId: 'b', documents: [doc()] })]);
    const rows = pickerRows('transcribe', [candidate({ entryId: 'b', documents: [] })], [], '', extra);
    expect(rows[0]!.tags.map((t) => t.label)).toEqual(['文稿 · 中文']);
    expect(duplicateNote('transcribe', rows[0]!)).toMatch(
      /^这部视频已有中文文稿。默认新建一部视频.*选「取代这部视频的文稿」会换掉当前文稿/,
    );
  });
});

describe('write into an existing video', () => {
  const row = {
    documents: [
      doc({
        translations: [
          { documentId: 'tr_en1', language: 'en', units: 62, staleUnits: 0 },
          { documentId: 'tr_en2', language: 'en', units: 60, staleUnits: 2 },
          { documentId: 'tr_ja', language: 'ja', units: 58, staleUnits: 0 },
        ],
        dubs: [{ groupId: 'g1', language: 'en', translationId: 'tr_en1' }],
      }),
    ],
  };

  it('no-overwrite hint: when a translation or dub already exists in the same language, says a new one will be added', () => {
    expect(duplicateNote('translate-subtitles', row, 'en')).toBe('这个视频已有英语译文。这次会新增一份，原来的保留，用哪一份在编辑器里选。');
    expect(duplicateNote('translate-subtitles', row, 'fr')).toBeNull();
    expect(duplicateNote('dub', row, 'en')).toBe('这个视频已有英语配音。这次会新增一组，原来的保留。');
    expect(duplicateNote('dub', row, 'ja')).toBeNull();
    expect(duplicateNote('transcribe', { documents: [] })).toBeNull();
    expect(duplicateNote('transcribe', null)).toBeNull();
  });

  it('translations selectable for dubbing: with multiple in the same language, adds "第 N 份" and marks the source script', () => {
    const options = translationOptions(row);
    expect(options.map((o) => o.label)).toEqual(['英语译文 第 1 份', '英语译文 第 2 份', '日语译文']);
    expect(options[0]!.sub).toBe('译自中文文稿');
    expect(options[1]).toMatchObject({ id: 'tr_en2', documentId: 'doc_zh', stale: 2 });
    expect(translationOptions(null)).toEqual([]);
  });

  it('target language excludes the script\'s own language; the script defaults to the most recent one', () => {
    const two = { documents: [doc({ documentId: 'd1', language: 'en' }), doc({ documentId: 'd2', language: 'zh' })] };
    expect(sourceDocument(two)?.documentId).toBe('d2');
    expect(sourceDocument(two, 'd1')?.documentId).toBe('d1');
    expect(sourceDocument({ documents: [] })).toBeNull();
    expect(targetLangs(['zh-Hans', 'en', 'ja'], doc({ language: 'zh' }))).toEqual(['en', 'ja']);
    expect(targetLangs(['zh-Hans', 'en'], null)).toEqual(['zh-Hans', 'en']);
  });

  it('default target language: uses the previous choice if still selectable; when the source is English, translate to Simplified Chinese, otherwise to English', () => {
    expect(defaultTargetLang(['en', 'ja'], 'ja', 'zh')).toBe('ja');
    expect(defaultTargetLang(['en', 'ja'], 'ko', 'zh')).toBe('en');
    expect(defaultTargetLang(['zh-Hans', 'ja'], null, 'en-US')).toBe('zh-Hans');
    expect(defaultTargetLang(['zh-Hans', 'ja'], null, null)).toBe('zh-Hans');
    expect(defaultTargetLang([], null, null)).toBeNull();
  });
});

describe('re-transcribe destination (product design §5.11)', () => {
  const row = {
    documents: [
      doc({
        translations: [
          { documentId: 'tr_en', language: 'en', units: 62, staleUnits: 0 },
          { documentId: 'tr_ja', language: 'ja', units: 58, staleUnits: 3 },
        ],
        dubs: [
          { groupId: 'g1', language: 'en', translationId: 'tr_en' },
          { groupId: 'g2', language: 'en', translationId: 'tr_en' },
        ],
      }),
    ],
  };

  it('destinations exist only when a script exists: create new video first (default), replace after', () => {
    expect(retargetOptions({ documents: [] })).toBeNull();
    expect(retargetOptions(null)).toBeNull();
    expect(retargetOptions(row)!.map((o) => [o.key, o.label])).toEqual([
      ['new-video', '新建视频'],
      ['replace', '取代这部视频的文稿'],
    ]);
    expect(newVideoName('访谈第一集')).toBe('访谈第一集 · 重新转录');
  });

  it('impact card: one row per translation with its sentence count, dubs by language array; the rule is written only when translations exist; always says it can be undone', () => {
    const im = replaceImpact(row);
    expect(im.translations).toEqual(['英语 · 62 句', '日语 · 58 句']);
    expect(im.dubs).toEqual(['英语 · 2 组 · 句子译文不变的保留，标可能不一致']);
    expect(im.rule).toMatch(/「刷新过期译文」/);
    expect(im.undo).toBe('一笔事务，可以撤销');
    const bare = replaceImpact({ documents: [doc()] });
    expect(bare.translations).toEqual([]);
    expect(bare.rule).toBeNull();
  });
});

describe('transcription action for Space video items (product design §4.4)', () => {
  it('not offered while transcribing, queued, or the source file is missing; failed gives retry; with a script, re-transcribe, without one, transcribe; not offered when unknown', () => {
    expect(spaceTranscribeAction('running', true, false)).toBeNull();
    expect(spaceTranscribeAction('queued', false, false)).toBeNull();
    expect(spaceTranscribeAction(null, true, true)).toBeNull();
    expect(spaceTranscribeAction('failed', true, false)).toBe('retry');
    expect(spaceTranscribeAction('failed', null, false)).toBe('retry');
    expect(spaceTranscribeAction(null, true, false)).toBe('redo');
    expect(spaceTranscribeAction(null, false, false)).toBe('first');
    expect(spaceTranscribeAction(null, null, false)).toBeNull();
  });

  it('retry carries the most recent failed transcription, with workflow tasks preferred; a failure followed by a later success doesn\'t count', () => {
    const child = job({ jobId: 'child', state: 'failed', updatedAt: '2026-10-03T00:00:00Z' });
    const parent = job({
      jobId: 'parent',
      kind: 'pipeline',
      providerId: 'pipeline',
      modelId: 'transcribe',
      state: 'failed',
      updatedAt: '2026-10-02T00:00:00Z',
      pipeline: {
        name: 'transcribe',
        params: { provider: 'openai', model: 'gpt-4o-transcribe', language: 'en', diarize: true },
      } as unknown as JobRecord['pipeline'],
    });
    expect(failedTranscribeJob('vid_1', [child, parent])?.jobId).toBe('parent');
    expect(failedTranscribeJob('vid_1', [child])?.jobId).toBe('child');
    expect(failedTranscribeJob('vid_1', [parent, job({ jobId: 'ok', state: 'completed', updatedAt: '2026-10-04T00:00:00Z' })])).toBeNull();
    expect(failedTranscribeJob(null, [parent])).toBeNull();
    expect(retryParamsOf(parent)).toEqual({ provider: 'openai', model: 'gpt-4o-transcribe', language: 'en', diarize: true });
    // The provider and model on the flow's parent task record are not for transcription: don't fall back to them when the parameters don't specify them.
    expect(
      retryParamsOf(job({ kind: 'pipeline', pipeline: { name: 'transcribe', params: {} } as unknown as JobRecord['pipeline'] })),
    ).toEqual({
      provider: null,
      model: null,
      language: null,
      diarize: null,
    });
    expect(retryParamsOf(child)).toEqual({ provider: 'local', model: 'whisper', language: null, diarize: null });
  });
});
