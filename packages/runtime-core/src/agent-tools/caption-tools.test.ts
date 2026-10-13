import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CucCutClient } from '@cuccut/client';
import { editorWasmAvailable } from '@cuccut/jobs';
import { newId, type AgentMode, type CaptionItem, type Id, type Project } from '@cuccut/protocol';
import { resolveRuntimeHome } from '@cuccut/runtime-storage';
import { resolveEngineHostCommand } from '../videos/engine-host.ts';
import { startRuntime, type RunningRuntime } from '../runtime.ts';
import { TOOL_RISK } from './tool-scope.ts';
import { ToolDriver, tool, until, type Loose, type ToolSession } from './testing/fake-agent.ts';

/**
 * End to end for `captions_create` (architecture design §7.9, “operations for the agent to build caption layers”). The fake agent, through the real MCP endpoint, creates caption layers for the transcript and for its own written translation, which land in the real engine. Covers the source text, the translation, bilingual output, and repeated creation (no overwrite). Planning mode is read-only. The translation's sentences are derived through editor-wasm. Needs engine-host, ffmpeg and editor-wasm; skipped if they are missing.
 */

const engine = resolveEngineHostCommand();
const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const ready = !!engine && ffmpeg && editorWasmAvailable();
if (!ready) console.warn('跳过建字幕层工具测试：没有 engine-host、ffmpeg 或 editor-wasm');

describe.skipIf(!ready)('建字幕层工具（真实引擎）', () => {
  let fixtures: string;
  let audio: string;
  let dir: string;
  let runtime: RunningRuntime;
  let client: CucCutClient;
  let driver: ToolDriver;
  let project: Project;
  let conversationId: Id;
  let videoId: Id;
  let videoPath: string;
  let speechId: Id;

  beforeAll(async () => {
    fixtures = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-caption-tools-fixtures-'));
    audio = path.join(fixtures, 'voice.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ac', '1', audio]);
  });

  afterAll(async () => {
    await fs.rm(fixtures, { recursive: true, force: true });
  });

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-caption-tools-'));
    driver = new ToolDriver();
    runtime = await startRuntime({
      home: resolveRuntimeHome({ CUCCUT_HOME: dir }),
      drivers: () => [driver],
      watchSpace: false,
      engineHost: engine,
      videoGraceMs: 100,
      modelWorker: null,
    });
    const { endpoint, token } = runtime.discovery;
    client = new CucCutClient({
      resolve: async () => ({ endpoint, token }),
      client: { kind: 'desktop', name: 'test', version: '0' },
      reconnect: false,
    });
    await client.connect();
    ({ project } = await client.request('projects.create', { name: '字幕工具' }));
    ({
      conversation: { id: conversationId },
    } = await client.request('conversations.create', { projectId: project.id }));
    const opened = await client.request('videos.create', { projectId: project.id, name: '样片' });
    videoId = opened.ref.videoId;
    videoPath = opened.ref.relPath;
    const words = [
      { id: 'w1', start: 0, end: 500, text: 'Hello' },
      { id: 'w2', start: 500, end: 1000, text: 'there.' },
      { id: 'w3', start: 1600, end: 2000, text: 'Good' },
      { id: 'w4', start: 2000, end: 2500, text: 'morning.' },
    ];
    await client.request('edits.apply', {
      videoId,
      commandId: newId('cmd'),
      expectedRevision: opened.snapshot.video.revision,
      operations: [
        { type: 'importAsset', path: audio, ref: 'a' },
        { type: 'addItem', sequenceId: opened.snapshot.video.rootSequenceId, asset: { ref: 'a' }, alignment: 'nearest-frame' },
        {
          type: 'putDocument',
          kind: 'speech',
          language: 'en',
          sourceAsset: { ref: 'a' },
          body: { schema: 'cuccut.speech/1', clock: 'source-asset', timescale: 1000, speakers: [], words, sentences: null, chapters: [] },
        },
      ],
    });
    speechId = Object.values(runtime.videos.mirror(videoId)!.video.documents).find((d) => d.kind === 'speech')!.id;
  });

  afterEach(async () => {
    client?.close();
    await runtime?.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function send(mode: AgentMode): Promise<ToolSession> {
    await client.request('conversations.send', { conversationId, text: '加字幕', commandId: newId('cmd'), autonomy: mode });
    const session = await until(() => driver.sessions.find((s) => s.turnId));
    await until(() => runtime.harness.agentRun(conversationId).taskId);
    return session;
  }

  const video = () => runtime.videos.mirror(videoId)!.video;
  const captionItems = (documentId: Id) =>
    video().sequences[video().rootSequenceId]!.items.filter((i): i is CaptionItem => i.type === 'caption' && i.documentId === documentId);

  /** Writes a translation in the style of documents_read, with alignment set to null, which the Runtime fills in. */
  async function writeTranslation(session: ToolSession): Promise<{ translationId: Id; put: Loose }> {
    const read = await tool(session, 'documents_read', { video: videoPath, documentId: speechId });
    const basis = read.body.translationBasis;
    const inspected = await tool(session, 'videos_inspect', { video: videoPath });
    const texts = ['你好。', '早上好。'];
    const put = await tool(session, 'edits_apply', {
      video: videoPath,
      expectedRevision: inspected.body.revision,
      label: '写入中文译文',
      operations: [
        {
          type: 'putDocument',
          kind: 'translation',
          language: 'zh-Hans',
          sourceDocument: { documentId: speechId },
          body: {
            schema: 'cuccut.translation/2',
            language: 'zh-Hans',
            sourceBasis: basis.sourceBasis,
            units: basis.sentences.map((s: Loose, i: number) => ({
              id: `t-${s.id}`,
              sourceSentenceId: s.id,
              sourceFingerprint: s.fingerprint,
              naturalText: texts[i],
              alignment: null,
              status: 'draft',
            })),
          },
        },
      ],
    });
    expect(put.isError).toBe(false);
    const translationId = Object.values(video().documents).find((d) => d.kind === 'translation')!.id;
    return { translationId, put: put.body };
  }

  it('风险与 edits_apply 相同；规划模式下拒绝，视频不变', async () => {
    expect(TOOL_RISK.captions_create).toBe(TOOL_RISK.edits_apply);
    const session = await send('plan');
    const before = video().revision;
    const refused = await tool(session, 'captions_create', { video: videoPath, documentId: speechId });
    expect(refused.body.error.code).toBe('PLAN_ONLY');
    expect(video().revision).toBe(before);
  });

  it('转写建原文字幕；智能体写的译文补上对齐后建译文与双语字幕；再建一次不覆盖', async () => {
    const session = await send('auto');

    // Source text: placed in a newly created caption track, and shown.
    const original = await tool(session, 'captions_create', { video: videoPath, documentId: speechId });
    expect(original.isError).toBe(false);
    expect(original.body).toMatchObject({
      transactionId: expect.any(String),
      revision: { before: expect.any(String), after: video().revision },
      documentId: expect.any(String),
      trackId: expect.any(String),
      itemIds: [expect.any(String)],
      cueCount: 2,
      enabled: true,
      layoutProfileId: 'default',
      existing: null,
      approval: { risk: 'edit', decidedBy: 'auto' },
    });
    const originalDoc = original.body.documentId as Id;
    expect(video().documents[originalDoc]).toMatchObject({ kind: 'caption', sourceDocumentId: speechId });
    expect(captionItems(originalDoc).map((i) => [i.id, i.trackId, i.enabled])).toEqual([
      [original.body.itemIds[0], original.body.trackId, true],
    ]);
    expect(video().sequences[video().rootSequenceId]!.tracks.find((t) => t.id === original.body.trackId)?.kind).toBe('subtitle');

    const bilingualSpeech = await tool(session, 'captions_create', { video: videoPath, documentId: speechId, bilingual: true });
    expect(bilingualSpeech.body.error.code).toBe('INVALID_ARGUMENTS');

    // Translation: the two sentences with null alignment get sentence-level alignment from the Runtime.
    const { translationId, put } = await writeTranslation(session);
    expect(put.filledAlignments).toBe(2);
    const translation = await tool(session, 'documents_read', { video: videoPath, documentId: translationId });
    expect(translation.body.body.units.map((u: Loose) => u.alignment)).toEqual([
      expect.objectContaining({
        correspondence: 'sentence',
        blocks: [],
        sourceWordIds: ['w1', 'w2'],
        textHash: expect.stringMatching(/^sha256:/),
      }),
      expect.objectContaining({
        correspondence: 'sentence',
        blocks: [],
        sourceWordIds: ['w3', 'w4'],
        textHash: expect.stringMatching(/^sha256:/),
      }),
    ]);

    // Bilingual: the translation as one layer (a new track), sharing a newly created style with the source. The source stays on screen.
    const bilingual = await tool(session, 'captions_create', { video: videoPath, documentId: translationId, bilingual: true });
    expect(bilingual.isError).toBe(false);
    expect(bilingual.body).toMatchObject({
      cueCount: 2,
      enabled: true,
      bilingual: true,
      existing: null,
      pairedOriginal: { documentId: originalDoc, itemIds: original.body.itemIds },
    });
    expect(bilingual.body.trackId).not.toBe(original.body.trackId);
    const translated = captionItems(bilingual.body.documentId);
    expect(translated.map((i) => i.trackId)).toEqual([bilingual.body.trackId]);
    expect(video().documents[bilingual.body.documentId]).toMatchObject({
      kind: 'caption',
      language: 'zh-Hans',
      sourceDocumentId: translationId,
    });
    const cues = (await tool(session, 'documents_read', { video: videoPath, documentId: bilingual.body.documentId })).body.body.cues;
    expect(cues.map((c: Loose) => [c.text, c.start, c.end])).toEqual([
      ['你好。', 0, 1000],
      ['早上好。', 1600, 2500],
    ]);
    const style = translated[0]!.styleDocumentId;
    expect(style).toEqual(expect.any(String));
    expect(captionItems(originalDoc).map((i) => [i.enabled, i.styleDocumentId])).toEqual([[true, style]]);

    // The same translation created again (translation only): no overwrite. The new layer is added disabled, and the paired source is untouched.
    const again = await tool(session, 'captions_create', { video: videoPath, documentId: translationId });
    expect(again.isError).toBe(false);
    expect(again.body).toMatchObject({
      enabled: false,
      bilingual: false,
      existing: { documentId: bilingual.body.documentId, itemIds: translated.map((i) => i.id) },
      note: expect.stringContaining('it was not overwritten'),
    });
    expect(again.body.documentId).not.toBe(bilingual.body.documentId);
    expect(captionItems(again.body.documentId).map((i) => i.enabled)).toEqual([false]);
    expect(captionItems(originalDoc).map((i) => i.enabled)).toEqual([true]);
    expect(captionItems(bilingual.body.documentId).map((i) => i.enabled)).toEqual([true]);

    // The transcript created again: likewise a separate layer, disabled.
    const twice = await tool(session, 'captions_create', { video: videoPath, documentId: speechId, layoutProfileId: 'two-line' });
    expect(twice.body).toMatchObject({ enabled: false, layoutProfileId: 'two-line', existing: { documentId: originalDoc } });

    // Each time is one change, so a change card is added to the session.
    const cards = (await client.request('conversations.get', { conversationId })).items.filter((i) => i.kind === 'video-change');
    expect(cards.filter((c) => (c as Loose).label === '建立字幕层')).toHaveLength(4);
  });

  it('改已有的译文：从它生成的字幕层在同一笔里只换改过的句子的字幕条，时间照旧；标了过期的句子去掉字幕条', async () => {
    const session = await send('auto');
    const { translationId } = await writeTranslation(session);
    const layer = await tool(session, 'captions_create', { video: videoPath, documentId: translationId });
    expect(layer.isError).toBe(false);
    const captionId = layer.body.documentId as Id;
    const read = await tool(session, 'documents_read', { video: videoPath, documentId: translationId });
    const body = read.body.body;
    body.units[0].naturalText = '您好呀。';
    body.units[1].status = 'stale';
    const before = video().revision;
    const put = await tool(session, 'documents_put', { video: videoPath, document: translationId, label: '改一句译文', body });
    expect(put.isError).toBe(false);
    expect(put.body).toMatchObject({ syncedCaptions: 1, revision: { before, after: video().revision } });
    const cues = (await tool(session, 'documents_read', { video: videoPath, documentId: captionId })).body.body.cues;
    expect(cues.map((c: Loose) => [c.id, c.text, c.start, c.end])).toEqual([[`q-${body.units[0].id}`, '您好呀。', 0, 1000]]);
    // One change: the new versions of the translation and the caption document come from the same transaction.
    const docs = video().documents;
    const createdBy = (id: Id) => docs[id]!.revisions[docs[id]!.currentRevision]!.createdBy;
    expect(createdBy(captionId)).toBe(createdBy(translationId));
  });

  it('没有原文字幕层时给译文带 bilingual: true：一次调用两层都建、共用样式，pairedOriginal 标 created；撤销一笔两层一起撤', async () => {
    const session = await send('auto');
    const { translationId } = await writeTranslation(session);
    const before = video().revision;
    const bilingual = await tool(session, 'captions_create', { video: videoPath, documentId: translationId, bilingual: true });
    expect(bilingual.isError).toBe(false);
    expect(bilingual.body).toMatchObject({
      transactionId: expect.any(String),
      revision: { before, after: video().revision },
      documentId: expect.any(String),
      trackId: expect.any(String),
      itemIds: [expect.any(String)],
      cueCount: 2,
      enabled: true,
      bilingual: true,
      existing: null,
      pairedOriginal: { documentId: expect.any(String), itemIds: [expect.any(String)], created: true },
    });
    expect(bilingual.body).not.toHaveProperty('bilingualNote');
    const { documentId: translatedDoc, pairedOriginal } = bilingual.body;
    expect(pairedOriginal.documentId).not.toBe(translatedDoc);
    expect(video().documents[pairedOriginal.documentId]).toMatchObject({ kind: 'caption', sourceDocumentId: speechId });
    expect(video().documents[translatedDoc]).toMatchObject({ kind: 'caption', sourceDocumentId: translationId, language: 'zh-Hans' });
    const original = captionItems(pairedOriginal.documentId);
    const translated = captionItems(translatedDoc);
    expect(original.map((i) => i.id)).toEqual(pairedOriginal.itemIds);
    expect(translated.map((i) => i.id)).toEqual(bilingual.body.itemIds);
    expect(translated.map((i) => i.trackId)).toEqual([bilingual.body.trackId]);
    expect(original[0]!.trackId).not.toBe(translated[0]!.trackId);
    const style = translated[0]!.styleDocumentId;
    expect(style).toEqual(expect.any(String));
    expect(original.map((i) => [i.enabled, i.styleDocumentId])).toEqual([[true, style]]);
    expect(translated.map((i) => i.enabled)).toEqual([true]);
    const cues = (await tool(session, 'documents_read', { video: videoPath, documentId: pairedOriginal.documentId })).body.body.cues;
    expect(cues.map((c: Loose) => c.text)).toEqual(['Hello there.', 'Good morning.']);

    // One transaction: undoing it removes both the source and translation caption instances.
    const undone = await tool(session, 'edits_undo', { video: videoPath, transactionId: bilingual.body.transactionId });
    expect(undone.isError).toBe(false);
    expect(captionItems(pairedOriginal.documentId)).toEqual([]);
    expect(captionItems(translatedDoc)).toEqual([]);
    expect(video().sequences[video().rootSequenceId]!.items.filter((i) => i.type === 'caption')).toEqual([]);
  });

  it('不能建字幕层的文档与素材不在时间线上：明确的错误码，视频不变', async () => {
    const session = await send('auto');
    const inspected = await tool(session, 'videos_inspect', { video: videoPath });
    const missing = await tool(session, 'captions_create', { video: videoPath, documentId: 'doc_nope' });
    expect(missing.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    const itemId = video().sequences[video().rootSequenceId]!.items[0]!.id;
    const removed = await tool(session, 'edits_apply', {
      video: videoPath,
      expectedRevision: inspected.body.revision,
      label: '拿掉素材',
      operations: [{ type: 'deleteItems', itemIds: [itemId] }],
    });
    expect(removed.isError).toBe(false);
    const before = video().revision;
    const offline = await tool(session, 'captions_create', { video: videoPath, documentId: speechId });
    expect(offline.body.error).toMatchObject({ code: 'CAPTIONS_NOT_ON_TIMELINE', next: expect.any(String) });
    expect(video().revision).toBe(before);
  });
});
