import { refOf, type Localized } from '../message-ref.ts';
import { PublishingIssues as PI, type PublishingIssuesMessages } from '../messages/protocol/publishing-issues.ts';
import {
  CAPTION_LIMITS,
  FORMAT_NETWORK,
  SHORTS_MAX_SECONDS,
  UNSETTLED_DELIVERY_STATES,
  YOUTUBE_TAGS_LIMIT,
  YOUTUBE_TITLE_LIMIT,
  isEditableDelivery,
  type PinnedExport,
  type Publication,
  type PublicationIssue,
  type PublishingAccount,
  type PublishingConnection,
} from '../publishing.ts';
import { routeOptionIssues, routeUsesProviderAudience, youtubeTagsLength } from './capabilities.ts';
import { codePointLength, composeCaption, intendedTime, isValidTimezone, publicationApproved, resolveCopy } from './resolve.ts';
import { publishingAccountIdentity } from './schedule.ts';

/**
 * Publication validation (port of agentcut `lib/validate.ts`, rules in agentcut's §5). Pure and browser-safe: the UI's readiness check and the
 * Runtime's send check run the same rules. Each issue carries a code (its `publishingIssues` key) and a message reference.
 *
 * Phase 1 has no phone route, so agentcut's phone-source and phone-picker rules are not here (phase 3 re-adds them).
 */

export type PublicationIssueCode = keyof PublishingIssuesMessages;

type Params = Record<string, string | number>;

/** Builds an issue with its localized message reference. */
export function publicationIssue(destinationId: string | null, field: string, code: PublicationIssueCode, params?: Params): PublicationIssue {
  const build = PI[code] as unknown as (params?: Params) => Localized;
  const message = refOf(build(params));
  return params ? { destinationId, field, code, params, message } : { destinationId, field, code, message };
}

export interface PublicationValidationContext {
  accounts: readonly PublishingAccount[];
  connections: readonly PublishingConnection[];
  /** The pinned export the publication names, or null when none is pinned (or its record is missing). */
  pinned: PinnedExport | null;
  now?: number;
}

export function validatePublication(p: Publication, context: PublicationValidationContext): PublicationIssue[] {
  const { accounts, connections, pinned } = context;
  const now = context.now ?? Date.now();
  const issues: PublicationIssue[] = [];
  const add = (destinationId: string | null, field: string, code: PublicationIssueCode, params?: Params) =>
    issues.push(publicationIssue(destinationId, field, code, params));

  const exported = p.exportId !== null && pinned !== null && pinned.id === p.exportId ? pinned : null;
  if (!exported) add(null, 'export', 'exportRequired');
  else if (!publicationApproved(p)) add(null, 'approval', 'approvalRequired');
  if (!p.destinations.length) add(null, 'accounts', 'accountsRequired');
  if (!isValidTimezone(p.timezone)) add(null, 'timezone', 'timezoneInvalid');

  const seen = new Set<string>();
  for (const d of p.destinations) {
    if (d.state === 'cancelled') continue;
    const a = accounts.find((item) => item.id === d.accountId);
    const c = a ? connections.find((item) => item.id === a.connectionId) : undefined;
    if (!a || !c) {
      add(d.id, 'account', 'accountUnavailable');
      continue;
    }
    const identity = a.equivalentTo ?? a.id;
    if (seen.has(identity)) add(d.id, 'account', 'accountDuplicateRoute');
    seen.add(identity);
    if (!isEditableDelivery(d.state)) continue;

    if (a.disabled || a.needsReconnect || !c.configured) add(d.id, 'account', 'accountNotConnected');
    if (FORMAT_NETWORK[d.format] !== a.network) add(d.id, 'format', 'formatMismatch');
    const copy = resolveCopy(p.copy, d);
    if (!copy.description.trim()) add(d.id, 'description', 'descriptionRequired');
    if (a.network === 'youtube' && (!copy.title.trim() || codePointLength(copy.title) > YOUTUBE_TITLE_LIMIT)) {
      add(d.id, 'title', 'titleLength', { max: YOUTUBE_TITLE_LIMIT });
    }
    if (a.network === 'youtube' && d.options.madeForKids === null && !routeUsesProviderAudience(c.provider, d.options)) {
      add(d.id, 'audience', 'audienceRequired');
    }
    for (const code of routeOptionIssues(c.provider, a.network, d.options)) add(d.id, 'options', code);
    if (a.network === 'youtube' && youtubeTagsLength(d.options.tags) > YOUTUBE_TAGS_LIMIT) add(d.id, 'tags', 'tagsTooLong', { max: YOUTUBE_TAGS_LIMIT });
    if (exported && d.format === 'youtube-short' && exported.durationSec > SHORTS_MAX_SECONDS) add(d.id, 'video', 'shortTooLong');
    if (exported && d.format === 'youtube-video' && exported.height >= exported.width && exported.durationSec <= SHORTS_MAX_SECONDS) {
      add(d.id, 'format', 'shortsClassification');
    }
    if (exported && d.format !== 'youtube-video' && exported.height < exported.width) add(d.id, 'video', 'portraitRequired');
    const max = CAPTION_LIMITS[a.network];
    const length = codePointLength(composeCaption(copy));
    if (length > max) add(d.id, 'description', 'captionTooLong', { length, max });

    const at = intendedTime(p, d);
    const t = at ? Date.parse(at) : NaN;
    if (at && (!Number.isFinite(t) || t <= now)) add(d.id, 'time', 'timeInPast');
    if (p.expiresAt) {
      const expires = Date.parse(p.expiresAt);
      if (expires <= (at && Number.isFinite(t) ? t : now)) add(d.id, 'expiry', 'expiresBefore');
    }
  }
  return issues;
}

/**
 * Issues for editable destinations whose real account still has an unsettled delivery (waiting, sending, unconfirmed or cancelling) from another
 * release of the same video. The owner records that result before sending again.
 */
export function unsettledDeliveryIssues(
  p: Publication,
  publications: readonly Publication[],
  accounts: readonly PublishingAccount[],
): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  for (const d of p.destinations) {
    if (!isEditableDelivery(d.state)) continue;
    const identity = publishingAccountIdentity(accounts, d.accountId);
    const unsettled = publications.some(
      (other) =>
        other.id !== p.id &&
        other.videoId === p.videoId &&
        other.sequenceId === p.sequenceId &&
        other.destinations.some(
          (previous) => publishingAccountIdentity(accounts, previous.accountId) === identity && UNSETTLED_DELIVERY_STATES.includes(previous.state),
        ),
    );
    if (unsettled) issues.push(publicationIssue(d.id, 'delivery', 'deliveryUnsettled'));
  }
  return issues;
}
