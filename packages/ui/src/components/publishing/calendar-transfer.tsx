'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import type { CalendarImportPreview } from '@cuccut/protocol';
import { cn } from 'cn';
import { Button, buttonVariants } from '../../cc/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../cc/ui/dialog';
import { shortenPath } from '../../model/format.ts';
import { calendarFileBytes, importSummary, parseCalendarFile, transferBlock } from '../../model/publishing-transfer.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { applyCalendarImport, exportCalendar, previewCalendarImport, publishingError } from '../../runtime/publishing-commands.ts';
import { usePublishing } from '../../state/publishing-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { downloadBlob } from '../media/gif.ts';
import { PC } from './publishing-copy.ts';

const SETTINGS_HREF = '/settings/publishing';

/**
 * "Export calendar" and "Import calendar" (design §2.3, agentcut `calendar-transfer.tsx`). Export saves every calendar record (unscheduled and archived
 * ones included) as a `cuccut-calendar` JSON file through the system save dialog. Import reads a chosen file, lets the Runtime preview it, then adds
 * the records that are not here yet (append-only, after a backup); it never sends or schedules anything. Both run in the desktop app only.
 */
export function CalendarTransfer({ onImported }: { onImported?: (firstDay: string | null) => void }) {
  const runtime = useRuntime();
  const owner = runtime.host.platform !== 'web';
  const readOnly = usePublishing((s) => !!s.degraded);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<{ tone: 'status' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const exportWhy = transferBlock('export', { owner, readOnly });
  const importWhy = transferBlock('import', { owner, readOnly });

  const download = async () => {
    setExporting(true);
    setStatus(null);
    try {
      const { archive, fileName } = await exportCalendar(runtime);
      const count = archive.publications.length;
      const data = calendarFileBytes(archive);
      if (runtime.host.saveFile) {
        const path = await runtime.host.saveFile({
          title: PC.transfer.saveTitle,
          buttonLabel: PC.transfer.saveButton,
          defaultName: fileName,
          filters: [{ name: PC.transfer.fileType, extensions: ['json'] }],
          data,
        });
        if (path) setStatus({ tone: 'status', text: PC.transfer.exportedTo(count, shortenPath(path)) });
      } else {
        downloadBlob(new Blob([data], { type: 'application/json' }), fileName);
        setStatus({ tone: 'status', text: PC.transfer.exported(count) });
      }
    } catch (e) {
      setStatus({ tone: 'error', text: PC.transfer.exportFailed(publishingError(e).message) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!!exportWhy || exporting} title={exportWhy ?? PC.transfer.exportHint} onClick={() => void download()}>
          {exporting ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Download aria-hidden />}
          {exporting ? PC.transfer.exporting : PC.calendar.export}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!!importWhy} title={importWhy ?? undefined} onClick={() => setOpen(true)}>
          <Upload aria-hidden />
          {PC.calendar.import}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{exportWhy ?? PC.calendar.transferScope}</p>
      {status ? (
        <p role={status.tone === 'error' ? 'alert' : 'status'} className={cn('max-w-sm text-right text-xs', status.tone === 'error' ? 'text-destructive' : 'text-foreground')}>
          {status.text}
        </p>
      ) : null}
      <ImportDialog
        open={open}
        onClose={() => setOpen(false)}
        onImported={(preview) => {
          setStatus({ tone: 'status', text: PC.transfer.importedStatus(preview.added, preview.skipped) });
          onImported?.(preview.firstDay);
        }}
      />
    </div>
  );
}

function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (preview: CalendarImportPreview) => void }) {
  const runtime = useRuntime();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [archive, setArchive] = useState<unknown>(null);
  const [preview, setPreview] = useState<CalendarImportPreview | null>(null);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const busy = reading || importing;

  const reset = () => {
    setFileName('');
    setArchive(null);
    setPreview(null);
    setComplete(false);
    setError('');
  };
  const read = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    setReading(true);
    try {
      const parsed = parseCalendarFile(await file.text());
      if ('error' in parsed) {
        setError(parsed.error);
        return;
      }
      setPreview(await previewCalendarImport(runtime, parsed.archive));
      setArchive(parsed.archive);
    } catch (e) {
      setError(publishingError(e).message);
    } finally {
      setReading(false);
    }
  };
  const apply = async () => {
    setImporting(true);
    setError('');
    try {
      const result = await applyCalendarImport(runtime, archive);
      setPreview(result.preview);
      setComplete(true);
      onImported(result.preview);
    } catch (e) {
      setError(publishingError(e).message);
    } finally {
      setImporting(false);
    }
  };
  const summary = preview ? importSummary(preview, complete) : null;
  const records = PC.transfer.records(preview?.added ?? 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || busy) return;
        reset();
        onClose();
      }}
    >
      <DialogContent data-cc showCloseButton={!busy} className="gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{complete ? PC.transfer.doneTitle : PC.transfer.title}</DialogTitle>
          <DialogDescription>{PC.transfer.lead}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{PC.transfer.includes}</p>
        {!complete ? (
          <div className="space-y-2">
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              aria-label={PC.transfer.fileLabel}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void read(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              {reading ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Upload aria-hidden />}
              {reading ? PC.transfer.reading : PC.transfer.choose}
            </Button>
            {fileName ? <p className="text-xs break-all text-muted-foreground">{fileName}</p> : null}
          </div>
        ) : null}
        {summary ? (
          <div role="status" className="space-y-2 rounded-2xl bg-foreground/5 p-4">
            <p className="font-medium text-foreground">{summary.headline}</p>
            {summary.lines.map((line) => (
              <p key={line} className="text-sm text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm whitespace-pre-wrap text-destructive">
            {error}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{PC.transfer.noSend}</p>
        <DialogFooter>
          {complete && preview && preview.reconnect > 0 ? (
            <a
              href={SETTINGS_HREF}
              className={buttonVariants({ variant: 'outline' })}
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                reset();
                onClose();
                useShell.getState().navigate(SETTINGS_HREF);
              }}
            >
              {PC.transfer.reviewAccounts}
            </a>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {complete ? PC.transfer.done : PC.transfer.cancel}
          </Button>
          {!complete && preview && preview.added > 0 ? (
            <Button type="button" disabled={busy} onClick={() => void apply()}>
              {importing ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
              {importing ? PC.transfer.importing : PC.transfer.submit(records)}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
