import type { Publication, PublicationDetail, PublicationRow, PublicationRowDestination, PublishingAccount, PublishingConnection } from '@cuccut/protocol';
import { publicationSchema, publishingAccountSchema, publishingConnectionSchema } from '@cuccut/protocol/schemas';

/** Record builders for the publishing UI tests. */

export const NOW = '2026-10-13T10:00:00.000Z';

export function rowDestination(overrides: Partial<PublicationRowDestination> & Pick<PublicationRowDestination, 'id'>): PublicationRowDestination {
  return { accountId: 'acc_yt', format: 'youtube-short', state: 'not_sent', scheduledAt: null, at: null, ...overrides };
}

export function row(overrides: Partial<PublicationRow> & Pick<PublicationRow, 'id'>): PublicationRow {
  return {
    videoId: `video_${overrides.id}`,
    projectId: null,
    label: `Clip ${overrides.id}`,
    status: 'draft',
    archived: false,
    revision: 1,
    scheduledAt: null,
    timezone: 'UTC',
    priority: 0,
    expiresAt: null,
    destinations: [rowDestination({ id: `${overrides.id}_d` })],
    ...overrides,
  };
}

export function publication(overrides: Partial<Publication> = {}): Publication {
  return publicationSchema.parse({
    id: 'pub_1',
    videoId: 'video_1',
    sequenceId: 'seq_1',
    label: 'Launch clip',
    videoName: 'Launch clip',
    timezone: 'UTC',
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    copy: { title: 'Title', description: 'Caption', hashtags: ['one'] },
    destinations: [{ id: 'dest_yt', accountId: 'acc_yt', format: 'youtube-short' }],
    ...overrides,
  }) as Publication;
}

export function detail(overrides: Partial<PublicationDetail> = {}): PublicationDetail {
  const { status, approved, videoAvailable, currentVideoRevision, newerEdit, issues, ...rest } = overrides;
  return {
    ...publication(rest),
    export: rest.export ?? null,
    status: status ?? 'draft',
    approved: approved ?? false,
    videoAvailable: videoAvailable ?? true,
    currentVideoRevision: currentVideoRevision ?? null,
    newerEdit: newerEdit ?? false,
    issues: issues ?? [],
  };
}

export function connection(overrides: Partial<PublishingConnection> = {}): PublishingConnection {
  return publishingConnectionSchema.parse({ id: 'conn_hand', provider: 'manual', name: 'By hand', configured: true, ...overrides }) as PublishingConnection;
}

export function account(overrides: Partial<PublishingAccount> & Pick<PublishingAccount, 'id'>): PublishingAccount {
  return publishingAccountSchema.parse({
    connectionId: 'conn_hand',
    remoteId: `@${overrides.id}`,
    network: 'youtube',
    name: overrides.id,
    ...overrides,
  }) as PublishingAccount;
}
