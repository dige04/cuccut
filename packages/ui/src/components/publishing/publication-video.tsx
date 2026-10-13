'use client';

import { useState } from 'react';
import { BadgeCheck, Check, Download, Film, FolderOpen, Loader2, Pin } from 'lucide-react';
import { intlLocale, type PinnableExport } from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../cc/ui/popover';
import { exportControls, formatInstant, pinnedExportPath } from '../../model/publication-sections.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { approveExport, pinExport, pinnableExports, publishingError } from '../../runtime/publishing-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import type { PublicationFormApi } from './publication-form.tsx';
import { PC } from './publishing-copy.ts';
import { usePinnedExport } from './use-pinned-export.ts';

/**
 * The dialog's Video column (design §2.4): a player on the pinned export, its facts, Reveal export, the newer-edit note, "Render and pin export" /
 * "Pin a finished export", and "Approve export". Every disabled control says why underneath.
 */
export function PublicationVideo({ form }: { form: PublicationFormApi }) {
  const runtime = useRuntime();
  const { saved } = form;
  const controls = exportControls(saved, form);
  const handle = usePinnedExport(saved.id, saved.exportId);
  const home = useConnection((s) => (s.state.status === 'connected' ? s.state.runtime.home : null));
  const pinned = saved.export;
  const canReveal = form.owner && !!home && !!pinned;

  return (
    <section aria-labelledby={`${form.id}-video`} className="flex min-w-0 flex-col gap-4 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 id={`${form.id}-video`} className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Film aria-hidden className="size-4" />
        {PC.form.video}
      </h3>
      {pinned && handle ? (
        <video
          controls
          preload="metadata"
          src={handle.url}
          className="max-h-48 w-full rounded-xl bg-black object-contain outline-1 -outline-offset-1 outline-white/10 sm:max-h-[360px]"
        />
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl bg-black/25 text-muted-foreground">
          <Film aria-hidden strokeWidth={1.5} className="size-8" />
          <p className="px-3 text-center text-xs">{saved.videoAvailable ? PC.form.previewEmpty : PC.form.missingVideo}</p>
        </div>
      )}
      {pinned ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{PC.form.pinned(pinned.width, pinned.height, Math.round(pinned.durationSec))}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canReveal}
            onClick={() => home && pinned && void runtime.host.revealPath(pinnedExportPath(home, pinned.sha256))}
          >
            <FolderOpen aria-hidden />
            {PC.form.reveal}
          </Button>
          {!form.owner ? <p className="text-xs text-muted-foreground">{PC.handover.revealUnavailable}</p> : null}
        </div>
      ) : null}
      {saved.newerEdit ? <p className="text-sm text-foreground">{PC.form.newerEdit}</p> : null}
      {controls.rendering ? (
        <p role="status" className="flex items-center gap-2 text-sm text-foreground">
          <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
          {PC.form.rendering}
        </p>
      ) : null}
      {controls.renderError ? (
        <p role="alert" className="text-sm text-destructive">
          {PC.form.renderFailed(controls.renderError)}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!!controls.pinBlock}
          onClick={() => void form.act(async () => (await pinExport(runtime, saved.id, saved.revision, { render: true })).publication)}
        >
          <Download aria-hidden />
          {controls.renderLabel}
        </Button>
        <PinFinished form={form} disabledReason={controls.pinBlock} />
        {controls.pinBlock ? <p className="text-xs text-muted-foreground">{controls.pinBlock}</p> : null}
      </div>
      {controls.approveVisible ? (
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            disabled={!!controls.approveBlock}
            onClick={() => void form.act(() => approveExport(runtime, saved.id, saved.revision), PC.form.exportApproved)}
          >
            <Check aria-hidden />
            {PC.form.approveExport}
          </Button>
          {controls.approveBlock && controls.approveBlock !== controls.pinBlock ? (
            <p className="text-xs text-muted-foreground">{controls.approveBlock}</p>
          ) : null}
        </div>
      ) : saved.approved ? (
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <BadgeCheck aria-hidden className="size-4 text-primary" />
          {PC.form.exportApproved}
        </p>
      ) : null}
    </section>
  );
}

/** "Pin a finished export": this video's finished MP4 exports. One from an earlier edit stays listed, disabled, with the reason. */
function PinFinished({ form, disabledReason }: { form: PublicationFormApi; disabledReason: string | null }) {
  const runtime = useRuntime();
  const [open, setOpen] = useState(false);
  const [exports, setExports] = useState<PinnableExport[] | null>(null);
  const [error, setError] = useState('');
  const { saved } = form;
  const load = () => {
    setExports(null);
    setError('');
    pinnableExports(runtime, saved.videoId).then(setExports, (e: unknown) => setError(publishingError(e).message));
  };
  return (
    <Popover
      open={open && !disabledReason}
      onOpenChange={(next) => {
        if (next) load();
        setOpen(next);
      }}
    >
      <PopoverTrigger render={<Button type="button" variant="outline" disabled={!!disabledReason} />}>
        <Pin aria-hidden />
        {PC.form.pinFinished}
      </PopoverTrigger>
      <PopoverContent data-cc side="bottom" className="w-80 max-w-[calc(100vw-1rem)] space-y-2" aria-label={PC.form.exportsLabel}>
        <p className="px-1 text-xs text-muted-foreground">{PC.form.exportsLabel}</p>
        {error ? (
          <p role="alert" className="px-1 text-sm text-destructive">
            {error}
          </p>
        ) : !exports ? (
          <p role="status" className="px-1 text-sm text-muted-foreground">
            {PC.form.loadingExports}
          </p>
        ) : !exports.length ? (
          <p className="px-1 text-sm text-muted-foreground">{PC.form.noFinished}</p>
        ) : (
          <ul className="space-y-1">
            {exports.map((item) => {
              const outdated = item.current === false;
              return (
                <li key={item.jobId}>
                  <button
                    type="button"
                    disabled={outdated}
                    onClick={() => {
                      setOpen(false);
                      void form.act(async () => (await pinExport(runtime, saved.id, saved.revision, { jobId: item.jobId })).publication);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 rounded-xl px-2.5 py-2 text-left text-sm outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <span className="text-foreground tabular-nums">{PC.form.exportItem(item.width, item.height, Math.round(item.durationSec))}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatInstant(item.createdAt, form.draft.timezone, intlLocale())}
                      {item.current === true ? ` · ${PC.form.exportCurrent}` : ''}
                      {outdated ? ` · ${PC.form.exportOutdated}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {exports?.some((item) => item.current === false) ? <p className="px-1 text-xs text-muted-foreground">{PC.form.exportStaleHint}</p> : null}
      </PopoverContent>
    </Popover>
  );
}
