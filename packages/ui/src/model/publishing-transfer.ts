import type { CalendarImportPreview } from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import { timezoneLabel } from './publishing-labels.ts';

/*
 * Calendar export and import in the UI (design `docs/cuccut/m2-publishing.md` §2.3, agentcut `calendar-transfer.tsx`). The Runtime reads, checks and
 * applies the file (`publishing.transfer.*`, desktop app only); the UI only reads the chosen file as JSON and says what the import will do.
 */

/** The chosen file's text as JSON, or the reason it cannot be read. The Runtime checks the calendar format itself. */
export function parseCalendarFile(text: string): { archive: unknown } | { error: string } {
  try {
    return { archive: JSON.parse(text) as unknown };
  } catch {
    return { error: PC.transfer.invalidJson };
  }
}

/** The exported calendar as the bytes of a readable JSON file. */
export function calendarFileBytes(archive: unknown): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${JSON.stringify(archive, null, 2)}\n`);
}

/** Why export or import is not available here, or null. Import also needs publishing to be writable. */
export function transferBlock(kind: 'export' | 'import', context: { owner: boolean; readOnly: boolean }): string | null {
  if (!context.owner) return PC.transfer.desktopOnly;
  if (kind === 'import' && context.readOnly) return PC.form.readOnly;
  return null;
}

/** The import summary: the headline and the lines that apply, in the order the owner acts on them. */
export function importSummary(preview: CalendarImportPreview, complete: boolean): { headline: string; lines: string[] } {
  const records = PC.transfer.records(preview.added);
  const lines = [PC.transfer.counts(preview.skipped, preview.total), PC.transfer.exportedIn(timezoneLabel(preview.timezone))];
  if (!preview.added) lines.push(PC.transfer.nothingNew);
  if (preview.missingVideos > 0) lines.push(PC.transfer.missingVideos(preview.missingVideos));
  if (preview.reconnect > 0) lines.push(PC.transfer.reconnect(preview.reconnect));
  if (preview.uncertain > 0) lines.push(PC.transfer.uncertain(preview.uncertain));
  return { headline: complete ? PC.transfer.imported(records) : PC.transfer.toImport(records), lines };
}
