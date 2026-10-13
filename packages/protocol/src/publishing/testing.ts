import type { PinnedExport, Publication, PublicationDestination, PublishingAccount, PublishingConnection } from '../publishing.ts';
import { pinnedExportSchema, publicationDestinationSchema, publicationSchema, publishingAccountSchema, publishingConnectionSchema } from '../publishing-schemas.ts';

/** Record builders for publishing tests. Not exported by the package index. */

export const TEST_NOW = '2026-10-13T10:00:00.000Z';

export function testDestination(overrides: Partial<PublicationDestination> & Pick<PublicationDestination, 'id' | 'accountId'>): PublicationDestination {
  return publicationDestinationSchema.parse({ format: 'youtube-short', ...overrides });
}

export function testPublication(overrides: Partial<Publication> = {}): Publication {
  return publicationSchema.parse({
    id: 'pub_1',
    videoId: 'video_1',
    sequenceId: 'seq_1',
    label: 'Launch clip',
    videoName: 'Launch clip',
    timezone: 'UTC',
    revision: 0,
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    copy: { title: 'Title', description: 'Caption', hashtags: ['one'] },
    destinations: [testDestination({ id: 'dest_1', accountId: 'acc_yt' })],
    ...overrides,
  });
}

export function testConnection(overrides: Partial<PublishingConnection> = {}): PublishingConnection {
  return publishingConnectionSchema.parse({ id: 'conn_1', provider: 'manual', name: 'By hand', configured: true, ...overrides });
}

export function testAccount(overrides: Partial<PublishingAccount> & Pick<PublishingAccount, 'id'>): PublishingAccount {
  return publishingAccountSchema.parse({ connectionId: 'conn_1', remoteId: `@${overrides.id}`, network: 'youtube', name: overrides.id, ...overrides });
}

export function testExport(overrides: Partial<PinnedExport> = {}): PinnedExport {
  const sha256 = overrides.sha256 ?? 'a'.repeat(64);
  return pinnedExportSchema.parse({
    id: `sha256:${sha256}`,
    videoId: 'video_1',
    sequenceId: 'seq_1',
    videoRevision: '1',
    jobId: 'job_1',
    sha256,
    bytes: 1000,
    width: 1080,
    height: 1920,
    durationSec: 30,
    codec: 'h264',
    createdAt: TEST_NOW,
    ...overrides,
  });
}
