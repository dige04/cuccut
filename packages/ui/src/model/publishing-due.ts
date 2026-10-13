import { dayInZone, FORMAT_NETWORK, isValidTimezone, type Id, type PublicationRow, type PublishingAccount } from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import type { PublishingDue } from '../state/publishing-store.ts';
import { networkLabel } from './publishing-labels.ts';

/** One "Time to post …" toast (design §2.1 flow 6) for a by-hand destination whose time arrived. */
export interface DueToast {
  key: string;
  publicationId: Id;
  destinationId: Id;
  text: string;
  /** The civil day of the reminder in the workspace timezone (where "Open" takes the calendar). */
  day: string | null;
}

/** A reminder is shown once per destination and time: a new send of the same destination (a new `due` event) is a new reminder. */
export function dueKey(due: PublishingDue): string {
  return `${due.publicationId}:${due.destinationId}:${due.at}`;
}

/**
 * The reminders still to show: queued `due` events not shown yet whose publication and destination are in the mirror (one that has not arrived
 * yet waits for the next update; one that is gone was already dropped from the queue by the store).
 */
export function dueToasts(
  due: readonly PublishingDue[],
  rows: readonly PublicationRow[],
  accounts: readonly PublishingAccount[],
  shown: ReadonlySet<string>,
  timezone: string,
): DueToast[] {
  const out: DueToast[] = [];
  for (const item of due) {
    const key = dueKey(item);
    if (shown.has(key)) continue;
    const row = rows.find((r) => r.id === item.publicationId);
    const destination = row?.destinations.find((d) => d.id === item.destinationId);
    if (!row || !destination) continue;
    const account = accounts.find((a) => a.id === destination.accountId);
    out.push({
      key,
      publicationId: item.publicationId,
      destinationId: item.destinationId,
      text: PC.calendar.dueToast(row.label, account?.name ?? networkLabel(FORMAT_NETWORK[destination.format])),
      day: isValidTimezone(timezone) && !Number.isNaN(Date.parse(item.at)) ? dayInZone(item.at, timezone) : null,
    });
  }
  return out;
}
