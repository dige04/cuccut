import { describe, expect, it } from 'vitest';
import type { DeliveryState, PublicationStatus } from '../publishing.ts';
import {
  calendarInstant,
  codePointLength,
  composeCaption,
  dayInZone,
  intendedTime,
  isValidTimezone,
  parseHashtags,
  publicationApproved,
  publicationAuthorized,
  publicationStatus,
  resolveCopy,
} from './resolve.ts';
import { testDestination, testPublication, TEST_NOW } from './testing.ts';

describe('copy resolution', () => {
  it('null inherits, empty clears, and hashtags are composed once', () => {
    const p = testPublication();
    const d = p.destinations[0]!;
    d.overrides.description = '';
    d.overrides.hashtags = [];
    expect(composeCaption(resolveCopy(p.copy, d))).toBe('');
    d.overrides.description = null;
    d.overrides.hashtags = null;
    expect(composeCaption(resolveCopy(p.copy, d))).toBe('Caption\n\n#one');
    expect(composeCaption({ title: '', description: 'Text #one', hashtags: ['one', 'two', 'two'] })).toBe('Text #one\n\n#two');
    d.overrides.title = 'Own title';
    expect(resolveCopy(p.copy, d).title).toBe('Own title');
  });

  it('counts code points, not UTF-16 units', () => {
    expect(codePointLength('😀😀')).toBe(2);
    expect('😀😀'.length).toBe(4);
    expect(codePointLength(composeCaption({ title: '', description: '😀', hashtags: ['ừ'] }))).toBe(1 + 2 + 2);
  });

  it('parses typed hashtags', () => {
    expect(parseHashtags('#one two,  ##three one #')).toEqual(['one', 'two', 'three']);
  });
});

describe('times', () => {
  it('a destination time overrides the default; the calendar prefers published, then confirmed', () => {
    const p = testPublication({ scheduledAt: '2026-10-20T10:00:00Z' });
    const d = testDestination({ id: 'd', accountId: 'a' });
    expect(intendedTime(p, d)).toBe('2026-10-20T10:00:00Z');
    d.scheduledAt = '2026-10-21T10:00:00Z';
    expect(intendedTime(p, d)).toBe('2026-10-21T10:00:00Z');
    d.confirmedAt = '2026-10-22T10:00:00Z';
    expect(calendarInstant(p, d)).toBe('2026-10-22T10:00:00Z');
    d.publishedAt = '2026-10-23T10:00:00Z';
    expect(calendarInstant(p, d)).toBe('2026-10-23T10:00:00Z');
    expect(calendarInstant({ scheduledAt: null }, testDestination({ id: 'x', accountId: 'a' }))).toBeNull();
  });

  it('civil day in a timezone', () => {
    expect(dayInZone('2026-10-13T23:30:00Z', 'UTC')).toBe('2026-10-13');
    expect(dayInZone('2026-10-13T23:30:00Z', 'Asia/Ho_Chi_Minh')).toBe('2026-10-14');
    expect(dayInZone('2026-10-13T03:30:00Z', 'America/Los_Angeles')).toBe('2026-10-12');
    expect(isValidTimezone('Europe/Paris')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });
});

describe('publication status', () => {
  const cases: Array<[DeliveryState[], boolean, PublicationStatus]> = [
    [[], false, 'draft'],
    [[], true, 'approved'],
    [['not_sent'], false, 'draft'],
    [['not_sent', 'not_sent'], true, 'approved'],
    [['queued'], true, 'pending'],
    [['queued', 'not_sent'], true, 'pending'],
    [['scheduled'], true, 'scheduled'],
    [['scheduled', 'cancelled'], false, 'scheduled'],
    [['scheduled', 'queued'], true, 'pending'],
    [['sending', 'queued'], true, 'publishing'],
    [['published'], false, 'published'],
    [['published', 'published'], true, 'published'],
    [['published', 'scheduled'], true, 'partial'],
    [['published', 'unknown'], true, 'partial'],
    [['failed', 'scheduled'], true, 'attention'],
    [['unknown'], true, 'attention'],
    [['cancel_pending'], true, 'attention'],
    [['failed', 'sending'], true, 'attention'],
    [['cancelled'], true, 'cancelled'],
    [['cancelled', 'cancelled'], false, 'cancelled'],
    [['cancelled', 'not_sent'], true, 'approved'],
  ];
  it.each(cases)('%j (approved %s) → %s', (states, approved, status) => {
    expect(publicationStatus({ destinations: states.map((state) => ({ state })) }, approved)).toBe(status);
  });

  it('approval holds only for the pinned export; authorization only for its revision', () => {
    const p = testPublication({ exportId: 'sha256:a', approval: { exportId: 'sha256:a', by: 'human', actor: 'desktop', at: TEST_NOW } });
    expect(publicationApproved(p)).toBe(true);
    expect(publicationApproved({ ...p, exportId: 'sha256:b' })).toBe(false);
    expect(publicationApproved({ ...p, exportId: null })).toBe(false);
    expect(publicationAuthorized({ authorization: { revision: 4, at: TEST_NOW }, revision: 4 })).toBe(true);
    expect(publicationAuthorized({ authorization: { revision: 4, at: TEST_NOW }, revision: 5 })).toBe(false);
    expect(publicationAuthorized({ authorization: null, revision: 0 })).toBe(false);
  });
});
