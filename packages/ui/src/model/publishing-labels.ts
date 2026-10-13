import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  Camera,
  CircleDashed,
  CircleSlash,
  Clock3,
  Hand,
  Loader2,
  Music2,
  Send,
  SquarePlay,
  type LucideIcon,
} from 'lucide-react';
import type {
  DeliveryState,
  PublicationStatus,
  PublishingAccount,
  PublishingConnection,
  PublishingFormat,
  PublishingNetwork,
  PublishingProvider,
} from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';

/**
 * Labels and icons of publishing states (design §2.3, agentcut `status.tsx`). Status never relies on colour alone: every badge carries an icon and a
 * word. `tone` picks the badge's emphasis — `attention` is the one tinted tone, so a calendar full of drafts stays quiet.
 */

export type PublishingTone = 'quiet' | 'ready' | 'attention';

export interface PublishingLabel {
  label: string;
  Icon: LucideIcon;
  tone: PublishingTone;
  /** The icon turns (work in progress); badges stop it under reduced motion. */
  spin?: boolean;
}

const STATUS_ICON: Record<PublicationStatus, LucideIcon> = {
  draft: CircleDashed,
  approved: BadgeCheck,
  pending: Clock3,
  publishing: Loader2,
  scheduled: CalendarClock,
  published: Send,
  partial: AlertCircle,
  attention: AlertCircle,
  cancelled: CircleSlash,
};

function statusTone(status: PublicationStatus): PublishingTone {
  if (status === 'attention' || status === 'partial') return 'attention';
  if (status === 'approved' || status === 'scheduled' || status === 'published') return 'ready';
  return 'quiet';
}

/** A publication's status. */
export function statusLabel(status: PublicationStatus): PublishingLabel {
  return { label: PC.status[status], Icon: STATUS_ICON[status], tone: statusTone(status), ...(status === 'publishing' ? { spin: true } : {}) };
}

export const NETWORK_ICON: Record<PublishingNetwork, LucideIcon> = { youtube: SquarePlay, instagram: Camera, tiktok: Music2 };

export function networkLabel(network: PublishingNetwork): string {
  return PC.network[network];
}

export function formatLabel(format: PublishingFormat): string {
  return PC.format[format];
}

export function providerLabel(provider: PublishingProvider): string {
  return PC.provider[provider];
}

/** What a destination's delivery badge needs to know beyond its state. */
export interface DeliveryContext {
  network: PublishingNetwork;
  /** The route posts by hand (the owner posts it in the app). */
  byHand: boolean;
  /** The destination has a time (its own or the publication's default). */
  hasTime: boolean;
}

/** A destination's delivery state, worded for its route: a by-hand destination that was sent is "Waiting for you". */
export function deliveryLabel(state: DeliveryState, context: DeliveryContext): PublishingLabel {
  switch (state) {
    case 'not_sent':
      return context.hasTime
        ? { label: PC.delivery.reserved, Icon: CalendarClock, tone: 'quiet' }
        : { label: PC.delivery.notScheduled, Icon: CircleDashed, tone: 'quiet' };
    case 'queued':
      return context.byHand
        ? { label: PC.delivery.waitingForYou, Icon: Hand, tone: 'attention' }
        : { label: PC.delivery.waiting, Icon: Clock3, tone: 'quiet' };
    case 'sending':
      return { label: PC.delivery.sending, Icon: Loader2, tone: 'quiet', spin: true };
    case 'scheduled':
      return { label: PC.delivery.scheduledOn(networkLabel(context.network)), Icon: CalendarClock, tone: 'ready' };
    case 'published':
      return { label: PC.delivery.published, Icon: Send, tone: 'ready' };
    case 'failed':
      return { label: PC.delivery.failed, Icon: AlertCircle, tone: 'attention' };
    case 'unknown':
      return { label: PC.delivery.unknown, Icon: AlertCircle, tone: 'attention' };
    case 'cancel_pending':
      return { label: PC.delivery.cancelling, Icon: Loader2, tone: 'quiet', spin: true };
    case 'cancelled':
      return { label: PC.delivery.cancelled, Icon: CircleSlash, tone: 'quiet' };
  }
}

/** The account and route of a destination, from the mirror (null when the account was removed). */
export function destinationRoute(
  accountId: string,
  accounts: readonly PublishingAccount[],
  connections: readonly PublishingConnection[],
): { account: PublishingAccount; connection: PublishingConnection | null; byHand: boolean } | null {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return null;
  const connection = connections.find((c) => c.id === account.connectionId) ?? null;
  return { account, connection, byHand: connection?.provider === 'manual' };
}

// ---- Timezones ----

/** An IANA zone as people read it: `America/New_York` → `America/New York`. */
export function timezoneLabel(timezone: string): string {
  return timezone.replaceAll('_', ' ');
}

/** The city of an IANA zone, for "All times in {city}": `America/New_York` → `New York`; a zone without a city stays whole (`UTC`). */
export function timezoneCity(timezone: string): string {
  const city = timezone.split('/').pop() || timezone;
  return city.replaceAll('_', ' ');
}

let zones: string[] | null = null;

/**
 * The zones the timezone select offers: every IANA zone this runtime knows (`Intl.supportedValuesOf`), plus `UTC` and `current` when the list leaves
 * them out (engines list canonical zones only, so a saved alias still shows).
 */
export function timezoneOptions(current?: string): string[] {
  if (!zones) {
    let known: string[] = [];
    try {
      known = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    } catch {
      known = [];
    }
    zones = [...new Set([...known, 'UTC'])].sort((a, b) => a.localeCompare(b));
  }
  return current && !zones.includes(current) ? [...zones, current].sort((a, b) => a.localeCompare(b)) : zones;
}

const offsetFormats = new Map<string, Intl.DateTimeFormat | null>();

/** The zone's UTC offset at `now` as the platform names it (`GMT+7`), or '' when the zone is unknown. */
export function timezoneOffset(timezone: string, now: number = Date.now()): string {
  let format = offsetFormats.get(timezone);
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' });
    } catch {
      format = null;
    }
    offsetFormats.set(timezone, format);
  }
  return format?.formatToParts(new Date(now)).find((part) => part.type === 'timeZoneName')?.value ?? '';
}
