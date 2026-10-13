import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRef } from '../message-ref.ts';
import { setLocale } from '../i18n.ts';
import type { Publication, PublicationIssue } from '../publishing.ts';
import { routeOptionIssues, youtubeTagsLength } from './capabilities.ts';
import { unsettledDeliveryIssues, validatePublication, type PublicationValidationContext } from './validate.ts';
import { testAccount, testConnection, testDestination, testExport, testPublication, TEST_NOW } from './testing.ts';
import { destinationOptionsSchema } from '../publishing-schemas.ts';

const NOW = Date.parse('2026-10-13T10:00:00Z');
const pinned = testExport();
const accounts = [
  testAccount({ id: 'acc_yt', network: 'youtube' }),
  testAccount({ id: 'acc_ig', network: 'instagram' }),
  testAccount({ id: 'acc_tt', network: 'tiktok' }),
];
const context: PublicationValidationContext = { accounts, connections: [testConnection()], pinned, now: NOW };

/** A publication that passes every rule. */
function ready(overrides: Partial<Publication> = {}): Publication {
  return testPublication({
    exportId: pinned.id,
    approval: { exportId: pinned.id, by: 'human', actor: 'desktop', at: TEST_NOW },
    scheduledAt: '2026-10-20T18:00:00Z',
    destinations: [
      testDestination({ id: 'yt', accountId: 'acc_yt', format: 'youtube-short', options: destinationOptionsSchema.parse({ madeForKids: false }) }),
      testDestination({ id: 'ig', accountId: 'acc_ig', format: 'instagram-reel' }),
      testDestination({ id: 'tt', accountId: 'acc_tt', format: 'tiktok-video' }),
    ],
    ...overrides,
  });
}

const codes = (issues: PublicationIssue[]) => issues.map((i) => `${i.destinationId ?? '-'}:${i.field}:${i.code}`);

function edit(p: Publication, destinationId: string, change: (d: Publication['destinations'][number]) => void): Publication {
  const d = p.destinations.find((item) => item.id === destinationId)!;
  change(d);
  return p;
}

describe('validatePublication', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  it('a complete publication has no issues', () => {
    expect(validatePublication(ready(), context)).toEqual([]);
  });

  it('issues carry a code and a message reference rendered in the reader\'s language', () => {
    const [issue] = validatePublication(ready({ approval: null }), context);
    expect(issue).toEqual({ destinationId: null, field: 'approval', code: 'approvalRequired', message: { key: 'publishingIssues.approvalRequired' } });
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    expect(formatRef(issue!.message, '')).toBe('Approve the pinned export before publishing.');
    const [long] = validatePublication(edit(ready(), 'ig', (d) => (d.overrides.description = 'x'.repeat(2201))), context).filter((i) => i.code === 'captionTooLong');
    expect(long?.params).toEqual({ length: 2201 + '\n\n#one'.length, max: 2200 });
    expect(formatRef(long!.message, '')).toContain('2200');
  });

  it('publication-level rules', () => {
    expect(codes(validatePublication(ready({ exportId: null }), context))).toEqual(['-:export:exportRequired']);
    expect(codes(validatePublication(ready(), { ...context, pinned: null }))).toEqual(['-:export:exportRequired']);
    expect(codes(validatePublication(ready({ approval: { exportId: 'sha256:old', by: 'agent', actor: 'a', at: TEST_NOW } }), context))).toEqual([
      '-:approval:approvalRequired',
    ]);
    expect(codes(validatePublication(ready({ destinations: [] }), context))).toEqual(['-:accounts:accountsRequired']);
    expect(codes(validatePublication(ready({ timezone: 'Nowhere/City' }), context))).toEqual(['-:timezone:timezoneInvalid']);
  });

  it('account rules', () => {
    const missing = ready();
    missing.destinations[0]!.accountId = 'gone';
    expect(codes(validatePublication(missing, context))).toEqual(['yt:account:accountUnavailable']);
    const linked = { ...context, accounts: [...accounts, testAccount({ id: 'alias', network: 'instagram', equivalentTo: 'acc_ig' })] };
    const twice = ready();
    twice.destinations.push(testDestination({ id: 'alias', accountId: 'alias', format: 'instagram-reel' }));
    expect(codes(validatePublication(twice, linked))).toEqual(['alias:account:accountDuplicateRoute']);
    const disabled = { ...context, accounts: accounts.map((a) => (a.id === 'acc_tt' ? { ...a, needsReconnect: true } : a)) };
    expect(codes(validatePublication(ready(), disabled))).toEqual(['tt:account:accountNotConnected']);
    expect(codes(validatePublication(ready(), { ...context, connections: [testConnection({ configured: false })] }))).toEqual([
      'yt:account:accountNotConnected',
      'ig:account:accountNotConnected',
      'tt:account:accountNotConnected',
    ]);
    // Cancelled destinations are not checked; submitted ones only for identity.
    expect(validatePublication(edit(ready(), 'yt', (d) => ((d.state = 'cancelled'), (d.accountId = 'gone'))), context)).toEqual([]);
    expect(validatePublication(edit(ready(), 'yt', (d) => ((d.state = 'published'), (d.overrides.description = ''))), context)).toEqual([]);
  });

  it('text rules', () => {
    expect(codes(validatePublication(edit(ready(), 'tt', (d) => (d.overrides.description = ' ')), context))).toEqual(['tt:description:descriptionRequired']);
    expect(codes(validatePublication(edit(ready(), 'yt', (d) => (d.overrides.title = '')), context))).toEqual(['yt:title:titleLength']);
    expect(codes(validatePublication(edit(ready(), 'yt', (d) => (d.overrides.title = '😀'.repeat(101))), context))).toEqual(['yt:title:titleLength']);
    expect(validatePublication(edit(ready(), 'yt', (d) => (d.overrides.title = '😀'.repeat(100))), context)).toEqual([]);
    expect(codes(validatePublication(edit(ready(), 'yt', (d) => (d.overrides.description = 'x'.repeat(5000))), context))).toEqual([
      'yt:description:captionTooLong',
    ]);
  });

  it('format, audience and option rules', () => {
    expect(codes(validatePublication(edit(ready(), 'ig', (d) => (d.format = 'tiktok-video')), context))).toEqual(['ig:format:formatMismatch']);
    expect(codes(validatePublication(edit(ready(), 'yt', (d) => (d.options.madeForKids = null)), context))).toEqual(['yt:audience:audienceRequired']);
    expect(codes(validatePublication(edit(ready(), 'ig', (d) => (d.options.privacy = 'unlisted')), context))).toEqual([
      'ig:options:optionUnlistedYoutubeOnly',
    ]);
    expect(codes(validatePublication(edit(ready(), 'tt', (d) => (d.options.tags = ['x'])), context))).toEqual(['tt:options:optionTagsYoutubeOnly']);
    expect(codes(validatePublication(edit(ready(), 'yt', (d) => (d.options.tags = ['a b'.repeat(100), 'c'.repeat(300)])), context))).toEqual([
      'yt:tags:tagsTooLong',
    ]);
  });

  it('video rules: Shorts length and classification, portrait formats', () => {
    const long = { ...context, pinned: testExport({ durationSec: 181 }) };
    expect(codes(validatePublication(ready(), long))).toEqual(['yt:video:shortTooLong']);
    expect(codes(validatePublication(edit(ready(), 'yt', (d) => (d.format = 'youtube-video')), context))).toEqual(['yt:format:shortsClassification']);
    expect(validatePublication(edit(ready(), 'yt', (d) => (d.format = 'youtube-video')), long)).toEqual([]);
    const landscape = { ...context, pinned: testExport({ width: 1920, height: 1080 }) };
    expect(codes(validatePublication(ready(), landscape))).toEqual(['yt:video:portraitRequired', 'ig:video:portraitRequired', 'tt:video:portraitRequired']);
    expect(validatePublication(edit(ready({ destinations: [ready().destinations[0]!] }), 'yt', (d) => (d.format = 'youtube-video')), landscape)).toEqual([]);
  });

  it('time and expiry rules', () => {
    expect(codes(validatePublication(ready({ scheduledAt: '2026-10-13T09:59:00Z' }), context))).toEqual([
      'yt:time:timeInPast',
      'ig:time:timeInPast',
      'tt:time:timeInPast',
    ]);
    expect(validatePublication(ready({ scheduledAt: null }), context)).toEqual([]);
    expect(codes(validatePublication(edit(ready({ expiresAt: '2026-10-19T00:00:00Z' }), 'yt', (d) => (d.scheduledAt = '2026-10-18T00:00:00Z')), context))).toEqual([
      'ig:expiry:expiresBefore',
      'tt:expiry:expiresBefore',
    ]);
    expect(codes(validatePublication(ready({ scheduledAt: null, expiresAt: '2026-10-13T09:00:00Z' }), context))).toEqual([
      'yt:expiry:expiresBefore',
      'ig:expiry:expiresBefore',
      'tt:expiry:expiresBefore',
    ]);
  });
});

describe('route options', () => {
  const options = () => destinationOptionsSchema.parse({});

  it('by hand only applies the network-level rules', () => {
    expect(routeOptionIssues('manual', 'youtube', { ...options(), tags: ['x'], synthetic: true, comments: false })).toEqual([]);
    expect(routeOptionIssues('manual', 'instagram', { ...options(), privacy: 'private', branded: true })).toEqual([]);
    expect(routeOptionIssues('manual', 'tiktok', { ...options(), privacy: 'unlisted', tags: ['x'] })).toEqual([
      'optionUnlistedYoutubeOnly',
      'optionTagsYoutubeOnly',
    ]);
  });

  it('API and phone routes report what they cannot apply', () => {
    expect(routeOptionIssues('postbridge', 'youtube', { ...options(), madeForKids: false })).toEqual(['optionPostbridgeYoutubeAudience']);
    expect(routeOptionIssues('postbridge', 'youtube', { ...options(), useProviderDefaults: true })).toEqual([]);
    expect(routeOptionIssues('postgun', 'youtube', { ...options(), synthetic: true })).toEqual(['optionPostgunSynthetic']);
    expect(routeOptionIssues('postgun', 'youtube', { ...options(), comments: false })).toEqual(['optionYoutubeApiInteractions']);
    expect(routeOptionIssues('postgun', 'instagram', { ...options(), synthetic: true })).toEqual(['optionInstagramApi']);
    expect(routeOptionIssues('iphone', 'youtube', { ...options(), tags: ['x'] })).toEqual(['optionPhoneYoutubeTags']);
    expect(routeOptionIssues('postgun', 'tiktok', { ...options(), privacy: 'unlisted' })).toEqual(['optionUnlistedYoutubeOnly']);
  });

  it('YouTube tags count separators and quotes', () => {
    expect(youtubeTagsLength(['ab', 'c d'])).toBe(3 + 6);
  });
});

describe('unsettled deliveries', () => {
  it('another release of the same video still waiting on the same real account blocks sending', () => {
    const linked = [...accounts, testAccount({ id: 'alias', network: 'youtube', equivalentTo: 'acc_yt' })];
    const earlier = testPublication({ id: 'earlier', destinations: [testDestination({ id: 'e', accountId: 'alias', state: 'unknown' })] });
    const otherVideo = testPublication({ id: 'other', videoId: 'video_2', destinations: [testDestination({ id: 'o', accountId: 'acc_ig', state: 'queued' })] });
    const p = ready({ id: 'repeat' });
    expect(codes(unsettledDeliveryIssues(p, [earlier, otherVideo, p], linked))).toEqual(['yt:delivery:deliveryUnsettled']);
    earlier.destinations[0]!.state = 'published';
    expect(unsettledDeliveryIssues(p, [earlier, otherVideo, p], linked)).toEqual([]);
  });
});
