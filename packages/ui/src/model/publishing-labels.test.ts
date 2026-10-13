import { CalendarClock, CircleDashed, Hand } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { PC } from '../components/publishing/publishing-copy.ts';
import {
  deliveryLabel,
  destinationRoute,
  statusLabel,
  timezoneCity,
  timezoneLabel,
  timezoneOffset,
  timezoneOptions,
} from './publishing-labels.ts';
import { account, connection } from './publishing-test-fixtures.ts';

describe('publishing labels', () => {
  it('every status has a word and an icon; attention is the one tinted tone', () => {
    expect(statusLabel('attention')).toMatchObject({ label: PC.status.attention, tone: 'attention' });
    expect(statusLabel('draft')).toMatchObject({ label: PC.status.draft, Icon: CircleDashed, tone: 'quiet' });
    expect(statusLabel('publishing').spin).toBe(true);
  });

  it('words a delivery for its route and time', () => {
    const youtube = { network: 'youtube' as const, byHand: true, hasTime: false };
    expect(deliveryLabel('not_sent', youtube)).toMatchObject({ label: PC.delivery.notScheduled });
    expect(deliveryLabel('not_sent', { ...youtube, hasTime: true })).toMatchObject({ label: PC.delivery.reserved, Icon: CalendarClock });
    expect(deliveryLabel('queued', youtube)).toMatchObject({ label: PC.delivery.waitingForYou, Icon: Hand, tone: 'attention' });
    expect(deliveryLabel('queued', { ...youtube, byHand: false })).toMatchObject({ label: PC.delivery.waiting });
    expect(deliveryLabel('scheduled', youtube).label).toBe(PC.delivery.scheduledOn('YouTube'));
  });

  it('finds the route of a destination’s account', () => {
    const accounts = [account({ id: 'a' })];
    expect(destinationRoute('a', accounts, [connection()])).toMatchObject({ byHand: true, connection: { id: 'conn_hand' } });
    expect(destinationRoute('a', accounts, [connection({ provider: 'postbridge' })])?.byHand).toBe(false);
    expect(destinationRoute('gone', accounts, [])).toBeNull();
  });

  it('names timezones for people and lists every zone once, keeping a saved one the list leaves out', () => {
    expect(timezoneLabel('America/New_York')).toBe('America/New York');
    expect(timezoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(timezoneCity('UTC')).toBe('UTC');
    const zones = timezoneOptions();
    expect(zones).toContain('Europe/Berlin');
    expect(zones).toContain('UTC');
    expect(new Set(zones).size).toBe(zones.length);
    expect(timezoneOptions('Etc/GMT+5')).toContain('Etc/GMT+5');
    expect(timezoneOffset('Asia/Ho_Chi_Minh', Date.parse('2026-10-14T00:00:00Z'))).toBe('GMT+7');
    expect(timezoneOffset('Not/AZone')).toBe('');
  });
});
