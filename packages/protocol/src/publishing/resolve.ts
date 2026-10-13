import type { DeliveryState, Publication, PublicationCopy, PublicationDestination, PublicationStatus } from '../publishing.ts';

/**
 * Text, time and status resolution for publications (port of agentcut `lib/resolve.ts` and `calendarInstant`). Pure and browser-safe.
 */

/** The text one destination sends: each override that is not null replaces the shared value (an empty override clears it). */
export function resolveCopy(base: PublicationCopy, destination: Pick<PublicationDestination, 'overrides'>): PublicationCopy {
  return {
    title: destination.overrides.title ?? base.title,
    description: destination.overrides.description ?? base.description,
    hashtags: destination.overrides.hashtags ?? base.hashtags,
  };
}

/**
 * The composed caption: the description, then a blank line and the hashtags that the description does not already contain. Hashtags are deduplicated.
 * Limits are counted in code points (`[...text].length`).
 */
export function composeCaption(copy: PublicationCopy): string {
  const tags = [...new Set(copy.hashtags)];
  const existing = new Set((copy.description.match(/#[^\s#]+/gu) ?? []).map((tag) => tag.slice(1)));
  return [
    copy.description.trim(),
    tags
      .filter((tag) => !existing.has(tag))
      .map((tag) => `#${tag}`)
      .join(' '),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Length in code points, as the networks count it. */
export function codePointLength(text: string): number {
  return [...text].length;
}

/** Normalizes typed hashtags: split on whitespace, strip leading `#`, drop empties and duplicates. */
export function parseHashtags(text: string): string[] {
  const tags = text
    .split(/[\s,]+/u)
    .map((tag) => tag.replace(/^#+/u, ''))
    .filter((tag) => tag.length > 0 && !tag.includes('#'));
  return [...new Set(tags)];
}

/** The time a destination is meant to go out: its own time, else the publication's default time. */
export function intendedTime(publication: Pick<Publication, 'scheduledAt'>, destination: Pick<PublicationDestination, 'scheduledAt'>): string | null {
  return destination.scheduledAt ?? publication.scheduledAt;
}

/** Where a destination sits on the calendar: when it was published, else when the network confirmed it, else its intended time. */
export function calendarInstant(
  publication: Pick<Publication, 'scheduledAt'>,
  destination: Pick<PublicationDestination, 'scheduledAt' | 'publishedAt' | 'confirmedAt'>,
): string | null {
  return destination.publishedAt ?? destination.confirmedAt ?? intendedTime(publication, destination);
}

/**
 * The status of a whole publication from its destinations' states, in agentcut's order: all published → published; some published → partial; any
 * failed/unknown/cancelling → attention; any sending → publishing; every non-cancelled one scheduled → scheduled; any queued or scheduled → pending;
 * all cancelled → cancelled; otherwise approved or draft.
 */
export function publicationStatus(publication: { destinations: ReadonlyArray<{ state: DeliveryState }> }, approved: boolean): PublicationStatus {
  const states = publication.destinations.map((d) => d.state);
  if (states.length && states.every((s) => s === 'published')) return 'published';
  if (states.includes('published')) return 'partial';
  if (states.some((s) => s === 'failed' || s === 'unknown' || s === 'cancel_pending')) return 'attention';
  if (states.includes('sending')) return 'publishing';
  const active = states.filter((s) => s !== 'cancelled');
  if (active.length && active.every((s) => s === 'scheduled')) return 'scheduled';
  if (states.some((s) => s === 'queued' || s === 'scheduled')) return 'pending';
  if (states.length && states.every((s) => s === 'cancelled')) return 'cancelled';
  return approved ? 'approved' : 'draft';
}

/** A publication is approved while its approval names the pinned export. */
export function publicationApproved(publication: Pick<Publication, 'approval' | 'exportId'>): boolean {
  return publication.exportId !== null && publication.approval?.exportId === publication.exportId;
}

/** The owner's authorization for an agent is valid only for the exact revision it was given for. */
export function publicationAuthorized(publication: Pick<Publication, 'authorization' | 'revision'>): boolean {
  return publication.authorization !== null && publication.authorization.revision === publication.revision;
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** The civil date (`YYYY-MM-DD`) of an instant in a timezone. */
export function dayInZone(iso: string, timezone: string): string {
  let format = dayFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormats.set(timezone, format);
  }
  const parts = format.formatToParts(new Date(iso));
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** Whether `timezone` is an IANA zone this runtime knows. */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
