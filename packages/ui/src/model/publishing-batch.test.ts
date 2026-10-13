import { describe, expect, it } from 'vitest';
import type { CalendarImportPreview } from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import {
  batchItems,
  batchOutcome,
  batchReserveBlock,
  batchSendBlock,
  chunks,
  isBatchReviewed,
  pageBlock,
  replaceId,
  reviewedCount,
  stepPage,
  type BatchContext,
} from './publishing-batch.ts';
import { dueKey, dueToasts } from './publishing-due.ts';
import { account, row, rowDestination } from './publishing-test-fixtures.ts';
import { calendarFileBytes, importSummary, parseCalendarFile, transferBlock } from './publishing-transfer.ts';

const rows = [row({ id: 'a', revision: 2 }), row({ id: 'b', revision: 5 })];

describe('batch reviews and sending', () => {
  it('counts a tick only for the revision it was given for', () => {
    expect(isBatchReviewed('a', { a: 2 }, rows)).toBe(true);
    expect(isBatchReviewed('a', { a: 1 }, rows)).toBe(false);
    expect(isBatchReviewed('gone', { gone: 1 }, rows)).toBe(false);
    expect(reviewedCount(['a', 'b'], { a: 2, b: 4 }, rows)).toBe(1);
  });

  it('sends each publication with the revision the mirror holds, leaving out missing ones', () => {
    expect(batchItems(['a', 'gone', 'b'], rows)).toEqual([
      { publicationId: 'a', revision: 2 },
      { publicationId: 'b', revision: 5 },
    ]);
  });

  it('says why sending is not available, in the order the owner fixes it', () => {
    const ready: BatchContext = { ids: ['a', 'b'], reviews: { a: 2, b: 5 }, rows, owner: true, readOnly: false, busy: false, dirty: false };
    expect(batchSendBlock(ready)).toBeNull();
    expect(batchSendBlock({ ...ready, ids: [] })).toBe(PC.batch.empty);
    expect(batchSendBlock({ ...ready, busy: true })).toBe(PC.form.busy);
    expect(batchSendBlock({ ...ready, owner: false })).toBe(PC.form.webOnly);
    expect(batchSendBlock({ ...ready, readOnly: true })).toBe(PC.form.readOnly);
    expect(batchSendBlock({ ...ready, dirty: true })).toBe(PC.form.needsSave);
    expect(batchSendBlock({ ...ready, reviews: { a: 2 } })).toBe(PC.batch.needsReviewAll);
  });

  it('needs weekly times and a clean page to reserve slots', () => {
    const ready = { ids: ['a'], readOnly: false, busy: false, dirty: false, slots: 2 };
    expect(batchReserveBlock(ready)).toBeNull();
    expect(batchReserveBlock({ ...ready, slots: 0 })).toBe(PC.form.reserveNeedsSlots);
    expect(batchReserveBlock({ ...ready, dirty: true })).toBe(PC.form.needsSave);
  });

  it('keeps the pager on a page with unsaved edits and within the list', () => {
    expect(pageBlock({ dirty: true, busy: false })).toBe(PC.batch.needsSavePage);
    expect(pageBlock({ dirty: false, busy: false })).toBeNull();
    expect(stepPage(0, -1, 3)).toBe(0);
    expect(stepPage(2, 1, 3)).toBe(2);
    expect(stepPage(1, 1, 3)).toBe(2);
    expect(stepPage(4, 0, 0)).toBe(0);
  });

  it('reports accepted publications and one line per refusal', () => {
    const outcome = batchOutcome(
      [
        { publicationId: 'a', ok: true },
        { publicationId: 'b', ok: false, error: { code: 'AUTHORIZATION_REQUIRED', message: 'Needs approval' } },
      ],
      (id) => `Clip ${id}`,
    );
    expect(outcome).toEqual({ accepted: 1, failures: [PC.batch.itemFailed('Clip b', 'Needs approval')] });
  });

  it('splits videos into prepare requests of at most 50 and replaces a new release in place', () => {
    const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
    expect(chunks(ids).map((c) => c.length)).toEqual([50, 50, 20]);
    expect(replaceId(['a', 'b', 'c'], 'b', 'b2')).toEqual(['a', 'b2', 'c']);
    expect(replaceId(['a', 'b', 'c'], 'b', 'c')).toEqual(['a', 'c']);
  });
});

describe('due reminders', () => {
  const due = [
    { publicationId: 'a', destinationId: 'a_d', at: '2026-10-13T23:30:00.000Z' },
    { publicationId: 'late', destinationId: 'x', at: '2026-10-13T10:00:00.000Z' },
  ];
  const accounts = [account({ id: 'acc_yt', name: 'Studio' })];

  it('shows each reminder once, naming the publication and the account', () => {
    const toasts = dueToasts(due, rows, accounts, new Set(), 'Asia/Bangkok');
    expect(toasts).toEqual([
      { key: dueKey(due[0]!), publicationId: 'a', destinationId: 'a_d', text: PC.calendar.dueToast('Clip a', 'Studio'), day: '2026-10-14' },
    ]);
    expect(dueToasts(due, rows, accounts, new Set([dueKey(due[0]!)]), 'UTC')).toEqual([]);
  });

  it('falls back to the network name and treats a new send as a new reminder', () => {
    const other = [row({ id: 'a', destinations: [rowDestination({ id: 'a_d', accountId: 'acc_gone', format: 'tiktok-video' })] })];
    expect(dueToasts(due, other, accounts, new Set(), 'UTC')[0]!.text).toBe(PC.calendar.dueToast('Clip a', PC.network.tiktok));
    expect(dueKey(due[0]!)).not.toBe(dueKey({ ...due[0]!, at: '2026-10-14T00:00:00.000Z' }));
  });
});

describe('calendar transfer', () => {
  it('reads JSON and refuses anything else with the next step', () => {
    expect(parseCalendarFile('{"format":"cuccut-calendar"}')).toEqual({ archive: { format: 'cuccut-calendar' } });
    expect(parseCalendarFile('not json')).toEqual({ error: PC.transfer.invalidJson });
    expect(new TextDecoder().decode(calendarFileBytes({ a: 1 }))).toBe('{\n  "a": 1\n}\n');
  });

  it('is the desktop app’s, and import needs publishing to be writable', () => {
    expect(transferBlock('export', { owner: false, readOnly: false })).toBe(PC.transfer.desktopOnly);
    expect(transferBlock('export', { owner: true, readOnly: true })).toBeNull();
    expect(transferBlock('import', { owner: true, readOnly: true })).toBe(PC.form.readOnly);
  });

  it('summarizes what an import adds and what needs attention', () => {
    const preview: CalendarImportPreview = {
      total: 5,
      added: 3,
      skipped: 2,
      reconnect: 1,
      missingVideos: 2,
      uncertain: 0,
      timezone: 'America/New_York',
      firstDay: '2026-10-20',
    };
    expect(importSummary(preview, false)).toEqual({
      headline: PC.transfer.toImport(PC.transfer.records(3)),
      lines: [PC.transfer.counts(2, 5), PC.transfer.exportedIn('America/New York'), PC.transfer.missingVideos(2), PC.transfer.reconnect(1)],
    });
    const none = importSummary({ ...preview, added: 0, reconnect: 0, missingVideos: 0 }, true);
    expect(none.headline).toBe(PC.transfer.imported(PC.transfer.records(0)));
    expect(none.lines).toContain(PC.transfer.nothingNew);
  });
});
