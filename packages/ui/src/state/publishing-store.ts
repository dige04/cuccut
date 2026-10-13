import { create } from 'zustand';
import type {
  Id,
  MessageRef,
  PublicationRow,
  PublishingAccount,
  PublishingConnection,
  PublishingEvent,
  PublishingSettings,
  PublishingSnapshot,
} from '@cuccut/protocol';

/** A by-hand destination whose time arrived (`due` event): the app shows "Time to post …" once, until it is opened or dismissed. */
export interface PublishingDue {
  publicationId: Id;
  destinationId: Id;
  at: string;
}

/**
 * Mirror of the `publishing` topic (design `docs/cuccut/m2-publishing.md` §4.4, §6.1): settings, connections, accounts and the calendar rows of
 * every publication that is not archived (plus ones archived in the last 30 days). The calendar filters this full mirror, so filters always apply
 * before pagination. `due` queues the reminders for by-hand destinations; an entry leaves when it is dismissed or its destination is no longer
 * waiting for the owner.
 */
export interface PublishingStore {
  ready: boolean;
  settings: PublishingSettings | null;
  connections: PublishingConnection[];
  accounts: PublishingAccount[];
  publications: PublicationRow[];
  /** Why publishing is read-only or unavailable, or null. */
  degraded: MessageRef | null;
  due: PublishingDue[];
  replace(snapshot: PublishingSnapshot): void;
  apply(event: PublishingEvent): void;
  dismissDue(publicationId: Id, destinationId?: Id): void;
  reset(): void;
}

type Data = Omit<PublishingStore, 'replace' | 'apply' | 'dismissDue' | 'reset'>;

export function emptyPublishing(): Data {
  return { ready: false, settings: null, connections: [], accounts: [], publications: [], degraded: null, due: [] };
}

/** Keeps the reminders whose destination is still waiting for the owner. */
function liveDue(due: PublishingDue[], publications: readonly PublicationRow[]): PublishingDue[] {
  if (!due.length) return due;
  const next = due.filter((item) => {
    const row = publications.find((p) => p.id === item.publicationId);
    return !row?.archived && row?.destinations.some((d) => d.id === item.destinationId && d.state === 'queued');
  });
  return next.length === due.length ? due : next;
}

export const usePublishing = create<PublishingStore>()((set) => ({
  ...emptyPublishing(),
  replace: (snapshot) =>
    set((s) => ({
      ready: true,
      settings: snapshot.settings,
      connections: snapshot.connections,
      accounts: snapshot.accounts,
      publications: snapshot.publications,
      degraded: snapshot.degraded,
      due: liveDue(s.due, snapshot.publications),
    })),
  apply: (event) =>
    set((s) => {
      switch (event.type) {
        case 'publication.upserted': {
          const at = s.publications.findIndex((p) => p.id === event.row.id);
          let publications: PublicationRow[];
          if (at < 0) publications = [...s.publications, event.row];
          else if (event.row.revision < s.publications[at]!.revision) return {};
          else {
            publications = [...s.publications];
            publications[at] = event.row;
          }
          return { publications, due: liveDue(s.due, publications) };
        }
        case 'publication.removed': {
          const publications = s.publications.filter((p) => p.id !== event.publicationId);
          return { publications, due: liveDue(s.due, publications) };
        }
        case 'settings.updated':
          return { settings: event.settings };
        case 'connections.updated':
          return { connections: event.connections, accounts: event.accounts };
        case 'due': {
          if (s.due.some((d) => d.publicationId === event.publicationId && d.destinationId === event.destinationId)) return {};
          return { due: [...s.due, { publicationId: event.publicationId, destinationId: event.destinationId, at: event.at }] };
        }
      }
    }),
  dismissDue: (publicationId, destinationId) =>
    set((s) => ({
      due: s.due.filter((d) => d.publicationId !== publicationId || (destinationId !== undefined && d.destinationId !== destinationId)),
    })),
  reset: () => set(emptyPublishing()),
}));
