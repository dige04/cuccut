import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PublicationDetail } from '@cuccut/protocol';
import { PROPOSAL_TRANSCRIPT_CHARS, parseProposal } from './publishing-copy.ts';
import { AGENT, HUMAN, codeOf, publishingFixture, type PublishingFixture } from './testing/fake-publishing.ts';

let root: string;
let fx: PublishingFixture;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-publishing-copy-'));
  fx = await publishingFixture(root);
});

afterEach(async () => {
  await fx.service.close();
  await fs.rm(root, { recursive: true, force: true });
});

async function until(check: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function prepared(): Promise<PublicationDetail> {
  const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_yt', 'acc_ig'] }, HUMAN);
  return p!;
}

const ANSWER = JSON.stringify({ title: '  Launch day  ', description: 'We shipped it.', hashtags: ['#launch', 'new product', 'launch'], reason: 'From the transcript.' });

describe('parseProposal', () => {
  it('reads the JSON answer and normalizes hashtags', () => {
    expect(parseProposal(ANSWER)).toEqual({
      copy: { title: 'Launch day', description: 'We shipped it.', hashtags: ['launch', 'new', 'product'] },
      reason: 'From the transcript.',
    });
    expect(parseProposal(JSON.stringify({ title: 't', description: 'd', hashtags: [] }))).toMatchObject({ reason: null });
  });

  it('returns null for answers that are not a proposal', () => {
    expect(parseProposal('not json')).toBeNull();
    expect(parseProposal(JSON.stringify({ title: 1 }))).toBeNull();
    expect(parseProposal(JSON.stringify(['a']))).toBeNull();
  });
});

describe('copy proposals', () => {
  it('asks the text model with the video, guidance and instruction, then stores the proposal without applying it', async () => {
    fx.videos.add({ videoId: 'video_1', transcript: 'word '.repeat(2000) });
    await fx.service.saveSettings({ ...fx.service.store.settings(), writing: 'Short, no emoji.' }, HUMAN);
    const p = await prepared();
    const { jobId } = await fx.service.copy.propose(p.id, '  Mention the launch  ', AGENT);

    const [sent] = fx.jobs.textRequests;
    expect(sent).toMatchObject({ jobId, submitter: AGENT.submitter, request: { responseFormat: { type: 'json', name: 'publication_text' } } });
    expect(sent!.request.messages.map((m) => m.role)).toEqual(['system', 'user']);
    const context = JSON.parse(sent!.request.messages[1]!.content as string) as Record<string, unknown>;
    expect(context).toMatchObject({
      video: { name: 'Launch clip' },
      networks: ['youtube', 'instagram'],
      writingGuidance: 'Short, no emoji.',
      instruction: 'Mention the launch',
      titleLimit: 100,
    });
    expect((context.transcriptExcerpt as string).length).toBe(PROPOSAL_TRANSCRIPT_CHARS);

    fx.jobs.answer(jobId, ANSWER);
    await until(() => fx.service.publication(p.id).proposal !== null);
    const saved = fx.service.get(p.id);
    expect(saved.proposal).toMatchObject({ revision: p.revision, jobId, reason: 'From the transcript.', copy: { title: 'Launch day' } });
    expect(saved.copy.title).toBe(p.copy.title);
  });

  it('ignores an answer it cannot read and a job that did not finish', async () => {
    const p = await prepared();
    const first = await fx.service.copy.propose(p.id, undefined, HUMAN);
    fx.jobs.answer(first.jobId, 'Sure! Here is a title: ...');
    const second = await fx.service.copy.propose(p.id, undefined, HUMAN);
    fx.jobs.set(second.jobId, { state: 'failed' });
    await until(() => fx.service.jobs.pending === 0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fx.service.publication(p.id).proposal).toBeNull();
    expect(fx.service.publication(p.id).revision).toBe(p.revision);
  });

  it('apply sets the shared text and clears the proposal', async () => {
    const p = await prepared();
    const proposed = await fx.service.copy.store(p.id, p.revision, { title: 'Agent title', description: 'Agent text', hashtags: ['x'] }, '  ', AGENT);
    expect(proposed.proposal).toMatchObject({ jobId: null, copy: { title: 'Agent title' }, reason: expect.any(String) });
    expect(proposed.copy.title).toBe(p.copy.title);
    const applied = await fx.service.copy.apply(p.id, proposed.revision, proposed.proposal!.copy, HUMAN);
    expect(applied.copy).toEqual({ title: 'Agent title', description: 'Agent text', hashtags: ['x'] });
    expect(applied.proposal).toBeNull();
  });

  it('refuses to store a proposal on an archived publication, or at a stale revision', async () => {
    const p = await prepared();
    const archived = await fx.service.archive(p.id, p.revision, HUMAN);
    const copy = { title: 't', description: 'd', hashtags: [] };
    expect(await codeOf(fx.service.copy.store(p.id, archived.revision, copy, 'r', AGENT))).toBe('PUBLICATION_ARCHIVED');
    expect(await codeOf(fx.service.copy.store(p.id, p.revision, copy, 'r', AGENT))).toBe('PUBLICATION_CONFLICT');
    expect(await codeOf(fx.service.copy.propose('pub_missing', undefined, AGENT))).toBe('PUBLICATION_NOT_FOUND');
  });
});
