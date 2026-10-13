import { describe, expect, it } from 'vitest';
import {
  defaultPublishingFormat,
  DESTINATION_OPTION_DEFAULTS,
  FORMAT_NETWORK,
  PUBLISHING_FORMATS,
  PUBLISHING_NETWORKS,
  PUBLISHING_SETTINGS_DEFAULTS,
  type Publication,
  type PublishingFileV1,
} from './publishing.ts';
import {
  calendarArchiveSchema,
  destinationInputSchema,
  destinationOptionsSchema,
  publicationCopySchema,
  publicationDestinationSchema,
  publicationSchema,
  publishingFileSchema,
  publishingSettingsInputSchema,
  publishingSettingsSchema,
} from './schemas.ts';

const NOW = '2026-10-13T10:00:00.000Z';

function publication(overrides: Partial<Publication> = {}): Publication {
  return publicationSchema.parse({
    id: 'pub_1',
    videoId: 'video_1',
    sequenceId: 'seq_1',
    label: 'Launch clip',
    timezone: 'Europe/Berlin',
    revision: 0,
    createdAt: NOW,
    updatedAt: NOW,
    destinations: [{ id: 'dest_1', accountId: 'acc_1', format: 'youtube-short' }],
    ...overrides,
  });
}

describe('publishing types', () => {
  it('every format belongs to a network, and each network has a default short-video format', () => {
    for (const format of PUBLISHING_FORMATS) expect(PUBLISHING_NETWORKS).toContain(FORMAT_NETWORK[format]);
    for (const network of PUBLISHING_NETWORKS) {
      const format = defaultPublishingFormat(network);
      expect(FORMAT_NETWORK[format]).toBe(network);
      expect(format).not.toBe('youtube-video');
    }
  });
});

describe('publishing schemas', () => {
  it('the option defaults of a new destination match the schema', () => {
    expect(destinationOptionsSchema.parse({})).toEqual(DESTINATION_OPTION_DEFAULTS);
  });

  it('fills defaults for a minimal publication and destination', () => {
    const p = publication();
    expect(p).toMatchObject({
      projectId: null,
      videoName: '',
      copy: { title: '', description: '', hashtags: [] },
      scheduledAt: null,
      priority: 0,
      expiresAt: null,
      exportId: null,
      approval: null,
      authorization: null,
      proposal: null,
      origin: null,
      archived: false,
      archivedAt: null,
    });
    expect(p.destinations[0]).toMatchObject({
      overrides: { title: null, description: null, hashtags: null },
      options: { privacy: 'public', madeForKids: null, comments: true, tags: [] },
      scheduledAt: null,
      state: 'not_sent',
      payload: null,
      error: null,
      errorRef: null,
      evidence: [],
    });
  });

  it('round-trips a full publication through JSON', () => {
    const p = publication({
      projectId: 'proj_1',
      copy: { title: 'Title', description: 'Body', hashtags: ['one', 'two'] },
      scheduledAt: '2026-10-20T18:00:00+02:00',
      expiresAt: '2026-11-01T00:00:00Z',
      exportId: 'sha256:abc',
      approval: { exportId: 'sha256:abc', by: 'human', actor: 'desktop', at: NOW },
      authorization: { revision: 3, at: NOW },
      proposal: { revision: 2, copy: { title: 'T', description: 'D', hashtags: [] }, reason: 'Shorter', jobId: null, at: NOW },
      archived: true,
      archivedAt: NOW,
    });
    const back = publicationSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(back).toEqual(p);
  });

  it('keeps loading records with keys from a later phase, but refuses broken ones', () => {
    const p = publication();
    expect(publicationSchema.parse({ ...p, laterField: 1 })).toEqual(p);
    expect(publicationSchema.safeParse({ ...p, scheduledAt: '2026-10-20 18:00' }).success).toBe(false);
    expect(publicationSchema.safeParse({ ...p, destinations: [{ id: 'd', accountId: 'a', format: 'vimeo' }] }).success).toBe(false);
    expect(publicationDestinationSchema.safeParse({ id: 'd', accountId: 'a', format: 'tiktok-video', state: 'lost' }).success).toBe(false);
  });

  it('hashtags are stored without # or spaces', () => {
    expect(publicationCopySchema.safeParse({ hashtags: ['#tag'] }).success).toBe(false);
    expect(publicationCopySchema.safeParse({ hashtags: ['two words'] }).success).toBe(false);
    expect(publicationCopySchema.parse({ hashtags: [' ok '] }).hashtags).toEqual(['ok']);
  });

  it('client inputs are strict', () => {
    expect(publicationCopySchema.safeParse({ title: 'x', extra: 1 }).success).toBe(false);
    expect(destinationInputSchema.safeParse({ accountId: 'a', format: 'tiktok-video', state: 'published' }).success).toBe(false);
    expect(destinationInputSchema.parse({ accountId: 'a', format: 'tiktok-video', options: { comments: false } })).toEqual({
      accountId: 'a',
      format: 'tiktok-video',
      options: { comments: false },
    });
    const settings = { timezone: 'UTC', ...PUBLISHING_SETTINGS_DEFAULTS };
    expect(publishingSettingsInputSchema.parse(settings)).toEqual(settings);
    expect(publishingSettingsInputSchema.safeParse({ ...settings, revision: undefined }).success).toBe(false);
    expect(publishingSettingsInputSchema.safeParse({ ...settings, slots: [{ weekday: 7, time: '18:00' }] }).success).toBe(false);
    expect(publishingSettingsInputSchema.safeParse({ ...settings, slots: [{ weekday: 1, time: '24:00' }] }).success).toBe(false);
  });

  it('stored settings take the defaults', () => {
    expect(publishingSettingsSchema.parse({ timezone: 'Asia/Ho_Chi_Minh' })).toEqual({ timezone: 'Asia/Ho_Chi_Minh', ...PUBLISHING_SETTINGS_DEFAULTS });
  });

  it('round-trips the store document', () => {
    const doc: PublishingFileV1 = publishingFileSchema.parse({
      schemaVersion: 1,
      settings: { timezone: 'UTC' },
      connections: [{ id: 'conn_1', provider: 'manual', name: 'By hand', configured: true }],
      accounts: [{ id: 'acc_1', connectionId: 'conn_1', remoteId: '@me', network: 'youtube', name: 'Me' }],
      publications: [publication()],
      exports: [
        {
          id: 'sha256:' + 'a'.repeat(64),
          videoId: 'video_1',
          sequenceId: 'seq_1',
          videoRevision: '7',
          jobId: 'job_1',
          sha256: 'a'.repeat(64),
          bytes: 10,
          width: 1080,
          height: 1920,
          durationSec: 12.5,
          codec: 'h264',
          createdAt: NOW,
        },
      ],
    });
    expect(doc.history).toEqual([]);
    expect(doc.imports).toEqual([]);
    expect(doc.exports[0]).toMatchObject({ sequenceRevision: null, fps: null });
    expect(publishingFileSchema.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(publishingFileSchema.safeParse({ ...doc, schemaVersion: 2 }).success).toBe(false);
  });

  it('a calendar archive is strict at the top level', () => {
    const archive = {
      format: 'cuccut-calendar',
      version: 1,
      exportedAt: NOW,
      timezone: 'UTC',
      publications: [publication()],
      accounts: [{ id: 'acc_1', connectionId: 'conn_1', remoteId: '@me', network: 'youtube', name: 'Me', equivalentTo: null }],
      connections: [{ id: 'conn_1', provider: 'manual', name: 'By hand' }],
    };
    expect(calendarArchiveSchema.parse(archive).publications).toHaveLength(1);
    expect(calendarArchiveSchema.safeParse({ ...archive, format: 'agentcut-calendar' }).success).toBe(false);
    expect(calendarArchiveSchema.safeParse({ ...archive, secrets: {} }).success).toBe(false);
  });
});
