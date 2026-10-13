import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Id, PublicationDetail, PublishingEvent } from '@cuccut/protocol';
import { AGENT, CLI, HUMAN, WEB, codeOf, publishingFixture, type PublishingFixture } from './testing/fake-publishing.ts';

const HOUR = 3_600_000;

let root: string;
let fx: PublishingFixture;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-publishing-'));
  fx = await publishingFixture(root);
});

afterEach(async () => {
  await fx.service.close();
  await fs.rm(root, { recursive: true, force: true });
});

async function prepare(accountIds: Id[] = ['acc_ig'], repeat = false): Promise<PublicationDetail> {
  const [p] = await fx.service.prepare({ videoIds: ['video_1'], accountIds, ...(repeat ? { repeat } : {}) }, HUMAN);
  return p!;
}

/** A publication with text, a pinned export and an approval: ready to authorize or send. */
async function ready(accountIds: Id[] = ['acc_ig']): Promise<PublicationDetail> {
  let p = await prepare(accountIds);
  p = await fx.service.update(
    {
      publicationId: p.id,
      revision: p.revision,
      patch: { copy: { title: 'Launch day', description: 'We shipped it', hashtags: ['launch'] } },
      destinations: p.destinations.map((d) => ({ id: d.id, accountId: d.accountId, format: d.format, options: { madeForKids: false } })),
    },
    HUMAN,
  );
  const { jobId } = await fx.jobs.finishedExport(`mp4 ${p.id}`);
  p = (await fx.service.pin(p.id, p.revision, { jobId }, HUMAN)).publication;
  return fx.service.approve(p.id, p.revision, HUMAN);
}

async function until(check: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function events(): PublishingEvent[] {
  const seen: PublishingEvent[] = [];
  fx.service.topic.subscribe(undefined, ({ event }) => seen.push(event));
  return seen;
}

describe('prepare', () => {
  it('reuses the latest publication of the video unless repeat asks for a new one', async () => {
    const first = await prepare();
    expect(first.videoName).toBe('Launch clip');
    expect(first.sequenceId).toBe('seq_1');
    expect(first.projectId).toBe('proj_1');
    expect(first.destinations.map((d) => [d.accountId, d.format])).toEqual([['acc_ig', 'instagram-reel']]);
    expect((await prepare()).id).toBe(first.id);
    const again = await prepare(['acc_ig'], true);
    expect(again.id).not.toBe(first.id);
    expect(fx.service.store.publications()).toHaveLength(2);
  });

  it('starts from the default accounts and refuses unknown videos and accounts', async () => {
    await fx.service.saveSettings({ ...fx.service.store.settings(), defaultAccountIds: ['acc_yt', 'acc_ig'] }, HUMAN);
    const [p] = await fx.service.prepare({ videoIds: ['video_1'] }, HUMAN);
    expect(p!.destinations.map((d) => d.accountId)).toEqual(['acc_yt', 'acc_ig']);
    expect(await codeOf(fx.service.prepare({ videoIds: ['video_x'] }, HUMAN))).toBe('VIDEO_NOT_FOUND');
    expect(await codeOf(fx.service.prepare({ videoIds: ['video_1'], accountIds: ['acc_x'] }, HUMAN))).toBe('ACCOUNT_NOT_FOUND');
  });

  it('a named sequence must belong to the one video given', async () => {
    fx.videos.add({ videoId: 'video_2', rootSequenceId: 'seq_main', sequenceIds: ['seq_main', 'seq_cut'] });
    expect(await codeOf(fx.service.prepare({ videoIds: ['video_2'], sequenceId: 'seq_1' }, HUMAN))).toBe('SEQUENCE_NOT_FOUND');
    expect(await codeOf(fx.service.prepare({ videoIds: ['video_1', 'video_2'], sequenceId: 'seq_cut' }, HUMAN))).toBe('SEQUENCE_ONE_VIDEO');
    const [p] = await fx.service.prepare({ videoIds: ['video_2'], sequenceId: 'seq_cut' }, HUMAN);
    expect(p!.sequenceId).toBe('seq_cut');
    expect(fx.service.store.publications()).toHaveLength(1);
  });
});

describe('update and reschedule', () => {
  it('refuses a stale revision with the current publication', async () => {
    const p = await prepare();
    await fx.service.update({ publicationId: p.id, revision: p.revision, patch: { label: 'One' } }, HUMAN);
    const error = await fx.service.update({ publicationId: p.id, revision: p.revision, patch: { label: 'Two' } }, HUMAN).catch((e: unknown) => e);
    expect((error as { details: { code: string; current: { label: string } } }).details).toMatchObject({ code: 'PUBLICATION_CONFLICT', current: { label: 'One' } });
  });

  it('locks the text once a destination was sent, but keeps no-op patches working', async () => {
    let p = await ready();
    p = await fx.service.send(p.id, p.revision, HUMAN);
    expect(await codeOf(fx.service.update({ publicationId: p.id, revision: p.revision, patch: { label: 'Changed' } }, HUMAN))).toBe('PUBLICATION_LOCKED');
    const same = await fx.service.update({ publicationId: p.id, revision: p.revision, patch: { label: p.label } }, HUMAN);
    expect(same.destinations[0]!.state).toBe('queued');
    expect(
      await codeOf(fx.service.update({ publicationId: p.id, revision: same.revision, patch: {}, destinations: [] }, HUMAN)),
    ).toBe('DESTINATION_LOCKED');
  });

  it('checks destination edits', async () => {
    const p = await prepare(['acc_yt', 'acc_ig']);
    const [yt] = p.destinations;
    const update = (destinations: Parameters<typeof fx.service.update>[0]['destinations']) =>
      fx.service.update({ publicationId: p.id, revision: p.revision, patch: {}, destinations }, HUMAN);
    expect(await codeOf(update([{ accountId: 'acc_ig', format: 'instagram-reel' }, { accountId: 'acc_ig', format: 'instagram-reel' }]))).toBe(
      'DUPLICATE_ACCOUNT',
    );
    expect(await codeOf(update([{ id: yt!.id, accountId: 'acc_ig', format: 'instagram-reel' }]))).toBe('DESTINATION_ACCOUNT_FIXED');
    expect(await codeOf(update([{ id: 'pdest_missing', accountId: 'acc_ig', format: 'instagram-reel' }]))).toBe('DESTINATION_NOT_FOUND');
    expect(await codeOf(update([{ accountId: 'acc_none', format: 'instagram-reel' }]))).toBe('ACCOUNT_NOT_FOUND');
    expect(await codeOf(fx.service.update({ publicationId: p.id, revision: p.revision, patch: { timezone: 'Mars/Base' } }, HUMAN))).toBe(
      'TIMEZONE_INVALID',
    );
    const saved = await update([{ id: yt!.id, accountId: 'acc_yt', format: 'youtube-video' }]);
    expect(saved.destinations.map((d) => [d.id, d.format])).toEqual([[yt!.id, 'youtube-video']]);
  });

  it('moves destinations atomically and refuses a time after the expiry', async () => {
    let p = await prepare(['acc_yt', 'acc_ig']);
    p = await fx.service.update({ publicationId: p.id, revision: p.revision, patch: { expiresAt: '2026-10-20T00:00:00.000Z' } }, HUMAN);
    const [yt, ig] = p.destinations;
    expect(
      await codeOf(
        fx.service.reschedule(
          p.id,
          p.revision,
          [
            { destinationId: yt!.id, at: '2026-10-15T09:00:00.000Z' },
            { destinationId: ig!.id, at: '2026-10-21T09:00:00.000Z' },
          ],
          HUMAN,
        ),
      ),
    ).toBe('AFTER_EXPIRY');
    expect(fx.service.publication(p.id).destinations.every((d) => d.scheduledAt === null)).toBe(true);
    expect(await codeOf(fx.service.reschedule(p.id, p.revision, [{ destinationId: yt!.id, at: null }, { destinationId: yt!.id, at: null }], HUMAN))).toBe(
      'DUPLICATE_PLACEMENT',
    );
    const moved = await fx.service.reschedule(p.id, p.revision, [{ destinationId: yt!.id, at: '2026-10-15T09:00:00.000Z' }], HUMAN);
    expect(moved.destinations.find((d) => d.id === yt!.id)!.scheduledAt).toBe('2026-10-15T09:00:00.000Z');
  });

  it('refuses a time too close to another publication on the same account (SLOT_TAKEN)', async () => {
    const a = await prepare();
    const b = await prepare(['acc_ig'], true);
    await fx.service.update({ publicationId: a.id, revision: a.revision, patch: { scheduledAt: '2026-10-15T09:00:00.000Z' } }, HUMAN);
    const error = await fx.service
      .update({ publicationId: b.id, revision: b.revision, patch: { scheduledAt: '2026-10-15T09:30:00.000Z' } }, HUMAN)
      .catch((e: unknown) => e);
    expect((error as { details: unknown }).details).toMatchObject({ code: 'SLOT_TAKEN', accountId: 'acc_ig' });
    await fx.service.update({ publicationId: b.id, revision: b.revision, patch: { scheduledAt: '2026-10-15T10:00:00.000Z' } }, HUMAN);
  });
});

describe('slots', () => {
  beforeEach(async () => {
    const slots = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, time: '18:00' }));
    await fx.service.saveSettings({ ...fx.service.store.settings(), slots }, HUMAN);
  });

  it('plans without writing, then reserves each publication a default time', async () => {
    const a = await prepare();
    const b = await prepare(['acc_ig'], true);
    const plan = await fx.service.slots({ publicationIds: [a.id, b.id] }, HUMAN);
    expect(plan.placements.map((item) => item.at)).toEqual(['2026-10-13T18:00:00.000Z', '2026-10-14T18:00:00.000Z']);
    expect(plan.publications).toEqual([]);
    expect(fx.service.publication(a.id).scheduledAt).toBeNull();

    expect(await codeOf(fx.service.slots({ publicationIds: [a.id], reserve: true }, HUMAN))).toBe('REVISION_REQUIRED');
    const reserved = await fx.service.slots({ publicationIds: [a.id, b.id], reserve: true, revisions: { [a.id]: a.revision, [b.id]: b.revision } }, HUMAN);
    // The same plan as the dry run, written as each publication's default time.
    expect(reserved.placements).toEqual(plan.placements);
    expect(reserved.publications.map((p) => [p.id, p.scheduledAt, p.revision])).toEqual(
      plan.placements.map((item) => [item.publicationId, item.at, 1]),
    );
    expect(new Set(plan.placements.map((item) => item.publicationId))).toEqual(new Set([a.id, b.id]));
  });

  it('reserving writes the default time and clears the accounts\' own times in one change', async () => {
    let p = await prepare(['acc_yt', 'acc_ig']);
    // Moved on the calendar once: one account has its own time (on the first free slot), the other has none, so it waits in Unscheduled.
    p = await fx.service.reschedule(p.id, p.revision, [{ destinationId: p.destinations[0]!.id, at: '2026-10-13T18:00:00.000Z' }], HUMAN);
    const plan = await fx.service.slots({ publicationIds: [p.id] }, HUMAN);
    // Its own account time does not block its own slot: those times are given up when it is reserved.
    expect(plan.placements).toEqual([{ publicationId: p.id, at: '2026-10-13T18:00:00.000Z' }]);
    const reserved = await fx.service.slots({ publicationIds: [p.id], reserve: true, revisions: { [p.id]: p.revision } }, HUMAN);
    const saved = reserved.publications[0]!;
    expect(saved).toMatchObject({ scheduledAt: '2026-10-13T18:00:00.000Z', revision: p.revision + 1 });
    expect(saved.destinations.map((d) => d.scheduledAt)).toEqual([null, null]);
  });

  it('leaves publications that already have a time unchanged', async () => {
    let a = await prepare();
    a = await fx.service.update({ publicationId: a.id, revision: a.revision, patch: { scheduledAt: '2026-10-13T18:00:00.000Z' } }, HUMAN);
    const b = await prepare(['acc_ig'], true);
    const reserved = await fx.service.slots({ publicationIds: [a.id, b.id], reserve: true, revisions: { [a.id]: a.revision, [b.id]: b.revision } }, HUMAN);
    expect(fx.service.publication(a.id).revision).toBe(a.revision);
    expect(reserved.placements).toEqual([
      { publicationId: a.id, at: '2026-10-13T18:00:00.000Z' },
      { publicationId: b.id, at: '2026-10-14T18:00:00.000Z' },
    ]);
  });
});

describe('approve, authorize and send', () => {
  it('needs a pinned export to approve and names who approved', async () => {
    const p = await prepare();
    expect(await codeOf(fx.service.approve(p.id, p.revision, HUMAN))).toBe('EXPORT_REQUIRED');
    const approved = await ready();
    expect(approved.approval).toMatchObject({ by: 'human', actor: 'Owner', exportId: approved.exportId });
    expect(approved.approved).toBe(true);
    expect(approved.issues).toEqual([]);
  });

  it('only the owner in the desktop app authorizes; any change voids it', async () => {
    const p = await ready();
    expect(await codeOf(fx.service.authorize(p.id, p.revision, AGENT))).toBe('OWNER_REQUIRED');
    expect(await codeOf(fx.service.authorize(p.id, p.revision, WEB))).toBe('OWNER_REQUIRED');
    expect(await codeOf(fx.service.authorize(p.id, p.revision, CLI))).toBe('OWNER_REQUIRED');
    const authorized = await fx.service.authorize(p.id, p.revision, HUMAN);
    expect(authorized.authorization?.revision).toBe(authorized.revision);

    const changed = await fx.service.update({ publicationId: p.id, revision: authorized.revision, patch: { label: 'Renamed' } }, HUMAN);
    expect(await codeOf(fx.service.send(p.id, changed.revision, AGENT))).toBe('AUTHORIZATION_REQUIRED');
    const again = await fx.service.authorize(p.id, changed.revision, HUMAN);
    const sent = await fx.service.send(p.id, again.revision, AGENT);
    expect(sent.destinations[0]!.state).toBe('queued');
  });

  it('refuses to authorize a publication with issues', async () => {
    const p = await prepare();
    const error = await fx.service.authorize(p.id, p.revision, HUMAN).catch((e: unknown) => e);
    const details = (error as { details: { code: string; issues: Array<{ code: string }> } }).details;
    expect(details.code).toBe('PUBLICATION_INVALID');
    expect(details.issues.map((issue) => issue.code)).toContain('exportRequired');
  });

  it('the browser cannot send; the command line needs an authorization like an agent', async () => {
    const p = await ready();
    expect(await codeOf(fx.service.send(p.id, p.revision, WEB))).toBe('OWNER_REQUIRED');
    expect(await codeOf(fx.service.send(p.id, p.revision, CLI))).toBe('AUTHORIZATION_REQUIRED');
  });

  it('by hand: send freezes the payload and waits for the owner; due fires once', async () => {
    let p = await ready(['acc_yt']);
    const seen = events();
    p = await fx.service.send(p.id, p.revision, HUMAN);
    const d = p.destinations[0]!;
    expect(d.state).toBe('queued');
    expect(d.payload).toMatchObject({ accountId: 'acc_yt', network: 'youtube', title: 'Launch day', caption: 'We shipped it\n\n#launch', scheduledAt: null });
    expect(d.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(p.status).toBeTruthy();
    expect(seen.filter((e) => e.type === 'due')).toEqual([{ type: 'due', publicationId: p.id, destinationId: d.id, at: '2026-10-13T10:00:00.000Z' }]);
    fx.service.dueTick();
    expect(seen.filter((e) => e.type === 'due')).toHaveLength(1);
    expect(await codeOf(fx.service.send(p.id, p.revision, HUMAN))).toBe('NOTHING_TO_SEND');
  });

  it('a reminder is not repeated when another account of the same publication changes', async () => {
    let p = await ready(['acc_yt', 'acc_ig']);
    const seen = events();
    p = await fx.service.send(p.id, p.revision, HUMAN);
    const [yt, ig] = p.destinations;
    expect(seen.filter((e) => e.type === 'due')).toHaveLength(2);
    fx.clock.advance(HOUR);
    // Recording the other account's result raises the revision; the account still waiting keeps its one reminder, with the same time.
    p = await fx.service.reconcile(
      { publicationId: p.id, revision: p.revision, destinationId: ig!.id, state: 'published', remoteUrl: null, at: null, note: 'Seen live in the app' },
      HUMAN,
    );
    fx.service.dueTick();
    const due = seen.filter((e) => e.type === 'due');
    expect(due).toHaveLength(2);
    expect(due.find((e) => e.destinationId === yt!.id)).toMatchObject({ at: '2026-10-13T10:00:00.000Z' });
    // Sending again after a withdrawal freezes a new payload: a new reminder.
    p = await fx.service.withdraw(p.id, p.revision, yt!.id, HUMAN);
    p = await fx.service.approve(p.id, p.revision, HUMAN);
    await fx.service.send(p.id, p.revision, HUMAN);
    expect(seen.filter((e) => e.type === 'due')).toHaveLength(3);
  });

  it('a scheduled by-hand delivery is due when its time arrives', async () => {
    let p = await ready();
    p = await fx.service.update({ publicationId: p.id, revision: p.revision, patch: { scheduledAt: '2026-10-13T12:00:00.000Z' } }, HUMAN);
    p = await fx.service.approve(p.id, p.revision, HUMAN);
    const seen = events();
    await fx.service.send(p.id, p.revision, HUMAN);
    expect(seen.filter((e) => e.type === 'due')).toEqual([]);
    fx.clock.advance(2 * HOUR);
    fx.service.dueTick();
    expect(seen.filter((e) => e.type === 'due')).toHaveLength(1);
  });

  it('refuses to send when the pinned file changed', async () => {
    const p = await ready();
    const pinned = fx.service.exportFile(p.id);
    await fs.chmod(pinned.file, 0o644);
    await fs.writeFile(pinned.file, 'tampered');
    expect(await codeOf(fx.service.send(p.id, p.revision, HUMAN))).toBe('EXPORT_CHANGED');
  });

  it('refuses a route this version cannot deliver through', async () => {
    await fx.service.store.transact((tx) => {
      tx.connections().push({ id: 'conn_pb', provider: 'postbridge', name: 'Post Bridge', configured: true, needsReconnect: false } as never);
      tx.accounts().push({ ...fx.service.store.accounts().find((a) => a.id === 'acc_ig')!, id: 'acc_pb', connectionId: 'conn_pb', remoteId: '@pb' });
    });
    const p = await ready(['acc_pb']);
    expect(await codeOf(fx.service.send(p.id, p.revision, HUMAN))).toBe('PROVIDER_UNSUPPORTED');
    expect(await codeOf(fx.service.saveConnection({ provider: 'postbridge', name: 'Post Bridge' }, HUMAN))).toBe('PROVIDER_UNSUPPORTED');
  });

  it('batch reports each item on its own', async () => {
    const a = await ready();
    const b = await prepare(['acc_yt'], true);
    const results = await fx.service.batch(
      'authorize',
      [
        { publicationId: a.id, revision: a.revision },
        { publicationId: b.id, revision: b.revision },
      ],
      HUMAN,
    );
    expect(results.map((r) => [r.publicationId, r.ok, r.error?.code])).toEqual([
      [a.id, true, undefined],
      [b.id, false, 'PUBLICATION_INVALID'],
    ]);
  });
});

describe('withdraw, cancel and reconcile', () => {
  async function sent(): Promise<PublicationDetail> {
    const p = await ready();
    return fx.service.send(p.id, p.revision, HUMAN);
  }

  it('withdraw takes a waiting destination back to unsent and keeps the payload in the history', async () => {
    const p = await sent();
    const d = p.destinations[0]!;
    const back = await fx.service.withdraw(p.id, p.revision, d.id, AGENT);
    expect(back.destinations[0]).toMatchObject({ state: 'not_sent', payload: null, payloadHash: null });
    expect(fx.service.store.read((doc) => doc.history.map((h) => h.destinationId))).toEqual([d.id]);
    expect(await codeOf(fx.service.withdraw(p.id, back.revision, d.id, HUMAN))).toBe('NOT_WAITING');
  });

  it('cancel is for the owner and for destinations not sent', async () => {
    const p = await prepare();
    const d = p.destinations[0]!;
    expect(await codeOf(fx.service.cancel(p.id, p.revision, d.id, AGENT))).toBe('OWNER_REQUIRED');
    const cancelled = await fx.service.cancel(p.id, p.revision, d.id, HUMAN);
    expect(cancelled.destinations[0]!.state).toBe('cancelled');
    expect(await codeOf(fx.service.cancel(p.id, cancelled.revision, d.id, HUMAN))).toBe('CANCEL_NOT_ALLOWED');
  });

  it('reconcile is the owner only and records what was verified', async () => {
    const p = await sent();
    const d = p.destinations[0]!;
    const params = {
      publicationId: p.id,
      revision: p.revision,
      destinationId: d.id,
      state: 'published' as const,
      remoteUrl: 'https://instagram.com/p/abc',
      at: null,
      note: 'Checked the post on Instagram',
    };
    expect(await codeOf(fx.service.reconcile(params, AGENT))).toBe('OWNER_REQUIRED');
    expect(await codeOf(fx.service.reconcile(params, CLI))).toBe('OWNER_REQUIRED');
    expect(await codeOf(fx.service.reconcile(params, WEB))).toBe('OWNER_REQUIRED');
    expect(await codeOf(fx.service.reconcile({ ...params, state: 'scheduled', at: '2026-10-13T09:00:00.000Z' }, HUMAN))).toBe('RECONCILE_TIME');
    const done = await fx.service.reconcile(params, HUMAN);
    expect(done.destinations[0]).toMatchObject({
      state: 'published',
      remoteUrl: 'https://instagram.com/p/abc',
      publishedAt: '2026-10-13T10:00:00.000Z',
      verification: { state: 'published', note: 'Checked the post on Instagram', by: 'Owner' },
    });
    expect(await codeOf(fx.service.reconcile({ ...params, revision: done.revision, state: 'not_sent' }, HUMAN))).toBe('RECONCILE_FINAL');
  });

  it('reconcile as not sent clears the payload so it can be sent again', async () => {
    const p = await sent();
    const d = p.destinations[0]!;
    const back = await fx.service.reconcile(
      { publicationId: p.id, revision: p.revision, destinationId: d.id, state: 'not_sent', remoteUrl: null, at: null, note: 'Never posted it' },
      HUMAN,
    );
    expect(back.destinations[0]).toMatchObject({ state: 'not_sent', payload: null });
  });
});

describe('archive and cleanup', () => {
  it('refuses to archive while a delivery is in flight, and unarchives', async () => {
    const p = await ready();
    const sentP = await fx.service.send(p.id, p.revision, HUMAN);
    expect(await codeOf(fx.service.archive(p.id, sentP.revision, HUMAN))).toBe('ARCHIVE_IN_FLIGHT');
    const other = await prepare(['acc_yt'], true);
    const archived = await fx.service.archive(other.id, other.revision, AGENT);
    expect(archived.archived).toBe(true);
    expect(await codeOf(fx.service.update({ publicationId: other.id, revision: archived.revision, patch: { label: 'x' } }, HUMAN))).toBe(
      'PUBLICATION_ARCHIVED',
    );
    // Neither is listed: one is archived, the other was sent by hand with no time (it waits for the owner, not for a time).
    expect(fx.service.calendar({ from: '2026-10-01', to: '2026-10-31' }).publications.map((row) => row.id)).toEqual([]);
    const back = await fx.service.unarchive(other.id, archived.revision, HUMAN);
    expect(back.archived).toBe(false);
  });

  it('cleanup deletes old archived publications and pinned files nothing uses', async () => {
    const p = await ready();
    const file = fx.service.exportFile(p.id).file;
    await fx.service.archive(p.id, p.revision, HUMAN);
    expect(await codeOf(fx.service.cleanup(AGENT))).toBe('OWNER_REQUIRED');
    expect(await fx.service.cleanup(HUMAN)).toEqual({ publications: 0, files: 0, bytes: 0 });
    fx.clock.advance(91 * 24 * HOUR);
    // The owner confirms what will go: a dry run names it and removes nothing.
    expect(await fx.service.cleanup(HUMAN, { dryRun: true })).toMatchObject({ publications: 1, files: 1 });
    expect(fx.service.store.publications()).toHaveLength(1);
    await fs.stat(file);
    const result = await fx.service.cleanup(HUMAN);
    expect(result).toMatchObject({ publications: 1, files: 1 });
    expect(fx.service.store.publications()).toEqual([]);
    expect(fx.service.store.exports()).toEqual([]);
    await expect(fs.stat(file)).rejects.toThrow();
  });
});

describe('calendar', () => {
  it('lists the days asked for plus unscheduled publications in creation order, filtered then paged', async () => {
    const a = await prepare();
    await fx.service.update({ publicationId: a.id, revision: a.revision, patch: { scheduledAt: '2026-10-15T09:00:00.000Z' } }, HUMAN);
    fx.clock.advance(1000);
    const b = await prepare(['acc_yt'], true);
    await fx.service.update({ publicationId: b.id, revision: b.revision, patch: { scheduledAt: '2026-11-20T09:00:00.000Z' } }, HUMAN);
    fx.clock.advance(1000);
    const c = await prepare(['acc_yt'], true);
    expect(fx.service.calendar({ from: '2026-10-01', to: '2026-10-31' }).publications.map((r) => r.id)).toEqual([a.id, c.id]);
    expect(fx.service.calendar({ from: '2026-10-01', to: '2026-10-31', includeUnscheduled: false }).publications.map((r) => r.id)).toEqual([a.id]);
    expect(fx.service.calendar({ from: '2026-10-01', to: '2026-12-31', accountIds: ['acc_yt'] }).publications.map((r) => r.id)).toEqual([b.id, c.id]);
    const page = fx.service.calendar({ from: '2026-10-01', to: '2026-12-31', limit: 2 });
    expect([page.total, page.nextOffset, page.publications.length]).toEqual([3, 2, 2]);
    expect(await codeOf(() => fx.service.calendar({ from: '2026-10-01', to: '2027-03-01' }))).toBe('CALENDAR_RANGE');
    expect(await codeOf(() => fx.service.calendar({ from: '2026-10-05', to: '2026-10-01' }))).toBe('CALENDAR_RANGE');
  });

  it('Unscheduled lists only publications with an account that can still get a time', async () => {
    const p = await ready(['acc_yt']);
    const unscheduled = () => fx.service.calendar({ from: '2026-12-01', to: '2026-12-31' }).publications.map((r) => r.id);
    expect(unscheduled()).toEqual([p.id]);
    // Sent by hand with no time: waiting for the owner, not for a time.
    await fx.service.send(p.id, p.revision, HUMAN);
    expect(unscheduled()).toEqual([]);
  });
});

describe('clips prepared automatically', () => {
  it('does nothing while "Prepare text and reserve times for generated clips" is off', async () => {
    await fx.service.prepareGenerated(['video_1'], AGENT);
    expect(fx.service.store.publications()).toEqual([]);
  });

  it('prepares a publication, applies the proposed text and reserves the next free slot', async () => {
    const slots = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, time: '18:00' }));
    await fx.service.saveSettings({ ...fx.service.store.settings(), slots, autoPrepare: true, defaultAccountIds: ['acc_ig'] }, HUMAN);
    await fx.service.prepareGenerated(['video_1', 'video_missing'], AGENT);
    const [p] = fx.service.store.publications();
    expect(p).toMatchObject({ origin: 'shorts', scheduledAt: '2026-10-13T18:00:00.000Z' });
    const job = fx.jobs.textRequests.at(-1)!;
    fx.jobs.answer(job.jobId, JSON.stringify({ title: 'Hook', description: 'Body', hashtags: ['tips'], reason: 'From the transcript' }));
    await until(() => fx.service.store.publication(p!.id)!.copy.title === 'Hook');
    expect(fx.service.store.publication(p!.id)).toMatchObject({ copy: { title: 'Hook', description: 'Body', hashtags: ['tips'] }, proposal: null });
  });
});

describe('settings, connections and accounts', () => {
  it('settings are saved by the owner (desktop or browser) only', async () => {
    const settings = fx.service.store.settings();
    expect(await codeOf(fx.service.saveSettings({ ...settings, writing: 'x' }, AGENT))).toBe('OWNER_REQUIRED');
    expect(await codeOf(fx.service.saveSettings({ ...settings, timezone: 'Nowhere/City' }, HUMAN))).toBe('TIMEZONE_INVALID');
    expect(await codeOf(fx.service.saveSettings({ ...settings, defaultAccountIds: ['acc_x'] }, HUMAN))).toBe('ACCOUNT_NOT_FOUND');
    const saved = await fx.service.saveSettings({ ...settings, writing: 'Short and plain', defaultAccountIds: ['acc_ig', 'acc_ig'] }, WEB);
    expect(saved).toMatchObject({ writing: 'Short and plain', defaultAccountIds: ['acc_ig'], revision: settings.revision + 1 });
    expect(await codeOf(fx.service.saveSettings({ ...settings }, HUMAN))).toBe('SETTINGS_CONFLICT');
  });

  it('connections and accounts are the owner in the desktop app only', async () => {
    expect(await codeOf(fx.service.saveConnection({ provider: 'manual', name: 'Phone' }, WEB))).toBe('OWNER_REQUIRED');
    expect(await codeOf(fx.service.saveAccount({ connectionId: 'conn_1', network: 'tiktok', name: 'T', remoteId: '@t' }, AGENT))).toBe('OWNER_REQUIRED');
    expect(await codeOf(fx.service.removeAccount('acc_ig', CLI))).toBe('OWNER_REQUIRED');
  });

  it('account rules: duplicates, fixed identity, in use, links', async () => {
    expect(await codeOf(fx.service.saveAccount({ connectionId: 'conn_1', network: 'youtube', name: 'Again', remoteId: '@main' }, HUMAN))).toBe(
      'ACCOUNT_DUPLICATE',
    );
    expect(await codeOf(fx.service.saveAccount({ id: 'acc_yt', connectionId: 'conn_1', network: 'tiktok', name: 'x', remoteId: '@x' }, HUMAN))).toBe(
      'ACCOUNT_IDENTITY_FIXED',
    );
    expect(await codeOf(fx.service.saveAccount({ connectionId: 'conn_none', network: 'tiktok', name: 'x', remoteId: '@x' }, HUMAN))).toBe(
      'CONNECTION_NOT_FOUND',
    );
    const second = await fx.service.saveAccount({ connectionId: 'conn_1', network: 'youtube', name: 'Second', remoteId: '@second' }, HUMAN);
    expect(await codeOf(fx.service.linkAccount(second.id, 'acc_ig', HUMAN))).toBe('LINK_INVALID');
    expect((await fx.service.linkAccount(second.id, 'acc_yt', HUMAN)).equivalentTo).toBe('acc_yt');
    expect(await codeOf(fx.service.linkAccount('acc_yt', second.id, HUMAN))).toBe('LINK_INVALID');

    const p = await ready();
    await fx.service.send(p.id, p.revision, HUMAN);
    expect(await codeOf(fx.service.removeAccount('acc_ig', HUMAN))).toBe('ACCOUNT_IN_USE');
    expect(await codeOf(fx.service.removeConnection('conn_1', HUMAN))).toBe('ACCOUNT_IN_USE');

    const removed = await fx.service.removeAccount('acc_yt', HUMAN);
    expect(removed.account.id).toBe('acc_yt');
    expect(fx.service.store.accounts().find((a) => a.id === second.id)!.equivalentTo).toBeNull();
    // Undo needs the links that went with it.
    expect(removed.refs).toEqual({ defaultAccountIds: [], links: [{ accountId: second.id, equivalentTo: 'acc_yt' }] });
  });

  it('saving an imported account confirms it', async () => {
    await fx.service.store.transact((tx) => void (tx.accounts().find((a) => a.id === 'acc_yt')!.needsReconnect = true));
    const confirmed = await fx.service.saveAccount({ id: 'acc_yt', connectionId: 'conn_1', network: 'youtube', name: 'Main channel', remoteId: '@main' }, HUMAN);
    expect(confirmed.needsReconnect).toBe(false);
  });

  it('removing a connection removes its accounts and the default accounts that named them', async () => {
    await fx.service.saveSettings({ ...fx.service.store.settings(), defaultAccountIds: ['acc_yt'] }, HUMAN);
    const result = await fx.service.removeConnection('conn_1', HUMAN);
    expect(result.accounts.map((a) => a.id).sort()).toEqual(['acc_ig', 'acc_yt']);
    expect(fx.service.store.accounts()).toEqual([]);
    expect(fx.service.store.settings().defaultAccountIds).toEqual([]);
    expect(result.refs).toEqual({ defaultAccountIds: ['acc_yt'], links: [] });
    // Undo: saving the removed records again restores them.
    await fx.service.saveConnection({ id: 'conn_1', provider: 'manual', name: 'By hand' }, HUMAN);
    expect(fx.service.store.connections().map((c) => c.id)).toEqual(['conn_1']);
    expect(await codeOf(fx.service.saveConnection({ id: 'conn_1', provider: 'postgun', name: 'x' }, HUMAN))).toBe('PROVIDER_UNSUPPORTED');
  });
});

describe('topic', () => {
  it('publishes row, settings and connection changes, and a snapshot of what is live', async () => {
    const seen = events();
    const p = await prepare();
    await fx.service.saveSettings({ ...fx.service.store.settings(), writing: 'Plain' }, HUMAN);
    await fx.service.saveAccount({ connectionId: 'conn_1', network: 'tiktok', name: 'Tok', remoteId: '@tok' }, HUMAN);
    expect(seen.map((e) => e.type)).toEqual(['publication.upserted', 'settings.updated', 'connections.updated']);
    expect(seen[0]).toMatchObject({ row: { id: p.id, status: expect.any(String), destinations: [{ accountId: 'acc_ig', at: null }] } });

    const archived = await fx.service.archive(p.id, p.revision, HUMAN);
    expect(fx.service.snapshot().publications.map((row) => [row.id, row.archived])).toEqual([[p.id, true]]);
    fx.clock.advance(31 * 24 * HOUR);
    expect(fx.service.snapshot().publications).toEqual([]);
    await fx.service.unarchive(p.id, archived.revision, HUMAN);
    expect(fx.service.snapshot().publications).toHaveLength(1);
  });

  it('close stops publishing and waits for the store', async () => {
    const seen = events();
    await fx.service.close();
    expect(fx.jobs.listeners).toBe(0);
    fx.service.dueTick();
    expect(seen).toEqual([]);
  });
});
