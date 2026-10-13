'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, ListChecks, Loader2, Send, Undo2, XIcon } from 'lucide-react';
import { formatRef, isValidTimezone, todayInZone, type Id } from '@cuccut/protocol';
import { cn } from 'cn';
import { Button } from '../../cc/ui/button';
import { Checkbox } from '../../cc/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../cc/ui/dialog';
import { Skeleton } from '../../cc/ui/skeleton';
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
  type BatchReviews,
  type BatchSource,
} from '../../model/publishing-batch.ts';
import { issueText } from '../../model/publication-sections.ts';
import { useRuntime } from '../../runtime/context.tsx';
import {
  batchPublications,
  preparePublications,
  publicationReadiness,
  publishingError,
  publishingSlots,
} from '../../runtime/publishing-commands.ts';
import { usePublishing } from '../../state/publishing-store.ts';
import { PublicationForm, usePublicationForm, type PublicationFormApi } from './publication-form.tsx';
import { PC } from './publishing-copy.ts';

/** Days "Reserve slots" looks ahead. */
const RESERVE_DAYS = 30;

interface CloseGuard {
  blocked: boolean;
}

type Notice = { tone: 'status' | 'error'; text: string; lines?: string[] } | null;

/**
 * The batch dialog (design §2.1 flow 8): "Prepare N publications" from the shorts result page (one publication per clip, prepared or reused) or
 * from the calendar's Unscheduled selection. A pager walks through them, each in the shared publication form with "Reviewed this publication";
 * "Reserve slots" plans the next free weekly slots for all of them; "Send N publications" (the one tinted action) or "Approve for agent" acts on
 * every publication once each is reviewed at its current revision. Like the publication dialog it cannot close while the page has unsaved edits or
 * an action runs.
 */
export function BatchPublicationsDialog({ source, onClose }: { source: BatchSource | null; onClose: () => void }) {
  const guard = useRef<CloseGuard>({ blocked: false });
  const [refused, setRefused] = useState(0);
  return (
    <Dialog
      open={!!source}
      onOpenChange={(open) => {
        if (open) return;
        if (guard.current.blocked) setRefused((n) => n + 1);
        else onClose();
      }}
    >
      <DialogContent
        data-cc
        showCloseButton={false}
        className="max-h-[92dvh] w-[min(70rem,calc(100%-2rem))] max-w-[calc(100%-2rem)] gap-5 overflow-y-auto sm:max-w-[70rem]"
      >
        {source ? <BatchBody source={source} guard={guard.current} refused={refused} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

type Load = { kind: 'loading' } | { kind: 'failed'; message: string } | { kind: 'ready' };

function BatchBody({ source, guard, refused, onClose }: { source: BatchSource; guard: CloseGuard; refused: number; onClose: () => void }) {
  const runtime = useRuntime();
  const owner = runtime.host.platform !== 'web';
  const rows = usePublishing((s) => s.publications);
  const settings = usePublishing((s) => s.settings);
  const readOnly = usePublishing((s) => !!s.degraded);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [ids, setIds] = useState<Id[]>([]);
  const [page, setPage] = useState(0);
  const [reviews, setReviews] = useState<BatchReviews>({});
  const [pageState, setPageState] = useState({ dirty: false, busy: false });
  const [action, setAction] = useState<'reserve' | 'send' | 'authorize' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [shownRefusal] = useState(refused);

  useEffect(() => {
    if (source.kind === 'publications') {
      setIds([...new Set(source.publicationIds)]);
      setLoad({ kind: 'ready' });
      return;
    }
    let live = true;
    setLoad({ kind: 'loading' });
    (async () => {
      const prepared: Id[] = [];
      for (const part of chunks(source.videoIds)) {
        const publications = await preparePublications(runtime, { videoIds: part, ...(source.origin ? { origin: source.origin } : {}) });
        prepared.push(...publications.map((p) => p.id));
      }
      return [...new Set(prepared)];
    })().then(
      (prepared) => {
        if (!live) return;
        setIds(prepared);
        setLoad({ kind: 'ready' });
      },
      (e: unknown) => live && setLoad({ kind: 'failed', message: publishingError(e).message }),
    );
    return () => {
      live = false;
    };
  }, [runtime, source, attempt]);

  const busy = pageState.busy || action !== null || load.kind === 'loading';
  const blocked = pageState.dirty || busy;
  useEffect(() => {
    guard.blocked = blocked;
  }, [guard, blocked]);
  useEffect(
    () => () => {
      guard.blocked = false;
    },
    [guard],
  );

  const current = ids[Math.min(page, Math.max(0, ids.length - 1))] ?? null;
  const labelOf = (id: Id) => rows.find((r) => r.id === id)?.label || PC.form.fallbackTitle;
  const context = { ids, reviews, rows, owner, readOnly, busy, dirty: pageState.dirty };
  const sendWhy = batchSendBlock(context);
  const reserveWhy = batchReserveBlock({ ...context, slots: settings?.slots.length ?? 0 });
  const pageWhy = pageBlock({ dirty: pageState.dirty, busy: pageState.busy || action !== null });
  const reviewed = reviewedCount(ids, reviews, rows);
  const onState = useCallback((state: { dirty: boolean; busy: boolean }) => setPageState(state), []);

  const reserve = async () => {
    setAction('reserve');
    setNotice(null);
    try {
      const items = batchItems(ids, rows);
      const timezone = settings && isValidTimezone(settings.timezone) ? settings.timezone : 'UTC';
      const result = await publishingSlots(runtime, {
        publicationIds: items.map((i) => i.publicationId),
        reserve: true,
        revisions: Object.fromEntries(items.map((i) => [i.publicationId, i.revision])),
        from: todayInZone(timezone),
        days: RESERVE_DAYS,
      });
      setNotice({
        tone: result.unavailable.length ? 'error' : 'status',
        text: PC.batch.reserved(result.placements.length),
        lines: result.unavailable.map((item) => PC.batch.unavailable(labelOf(item.publicationId), formatRef(item.reason, ''))),
      });
    } catch (e) {
      setNotice({ tone: 'error', text: publishingError(e).message });
    } finally {
      setAction(null);
    }
  };
  const deliver = async (kind: 'send' | 'authorize') => {
    setAction(kind);
    setNotice(null);
    try {
      const results = await batchPublications(runtime, kind, batchItems(ids, rows));
      const outcome = batchOutcome(results, labelOf);
      setNotice(
        outcome.failures.length
          ? { tone: 'error', text: PC.batch.partial(outcome.accepted, results.length), lines: outcome.failures }
          : { tone: 'status', text: kind === 'authorize' ? `${PC.batch.accepted(outcome.accepted)} ${PC.form.approvedAgent}` : PC.batch.accepted(outcome.accepted) },
      );
    } catch (e) {
      setNotice({ tone: 'error', text: publishingError(e).message });
    } finally {
      setAction(null);
    }
  };

  const count = load.kind === 'ready' ? ids.length : source.kind === 'videos' ? source.videoIds.length : source.publicationIds.length;

  return (
    <>
      <DialogHeader className="pr-10">
        <DialogTitle>{PC.batch.title(count)}</DialogTitle>
        <DialogDescription>{PC.batch.lead}</DialogDescription>
      </DialogHeader>
      {!blocked ? (
        <Button type="button" variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label={PC.batch.close} onClick={onClose}>
          <XIcon aria-hidden />
        </Button>
      ) : null}

      {load.kind === 'loading' ? (
        <div role="status" aria-label={PC.batch.preparing} className="space-y-3">
          <p className="text-sm text-muted-foreground">{PC.batch.preparing}</p>
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      ) : load.kind === 'failed' ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-destructive">{PC.batch.failed(load.message)}</p>
          <Button type="button" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {PC.batch.retry}
          </Button>
        </div>
      ) : !ids.length || !current ? (
        <p className="text-sm text-muted-foreground">{PC.batch.empty}</p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <nav aria-label={PC.batch.pagerLabel} className="flex flex-wrap items-center gap-2 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label={PC.batch.previous}
                disabled={page <= 0 || !!pageWhy}
                title={pageWhy ?? undefined}
                onClick={() => setPage((p) => stepPage(p, -1, ids.length))}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <span className="text-sm text-foreground tabular-nums" aria-live="polite">
                {PC.batch.pager(page + 1, ids.length)}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label={PC.batch.next}
                disabled={page >= ids.length - 1 || !!pageWhy}
                title={pageWhy ?? undefined}
                onClick={() => setPage((p) => stepPage(p, 1, ids.length))}
              >
                <ChevronRight aria-hidden />
              </Button>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{labelOf(current)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{PC.batch.reviewedCount(reviewed, ids.length)}</span>
              {pageWhy && ids.length > 1 ? <p className="basis-full text-xs text-muted-foreground">{pageWhy}</p> : null}
            </nav>
            <section aria-labelledby="batch-timing" className="space-y-2 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h3 id="batch-timing" className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarClock aria-hidden className="size-4" />
                    {PC.batch.timing(ids.length)}
                  </h3>
                  <p className="text-xs text-muted-foreground">{PC.batch.timingLead}</p>
                </div>
                <Button type="button" variant="outline" disabled={!!reserveWhy} onClick={() => void reserve()}>
                  {action === 'reserve' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
                  {action === 'reserve' ? PC.batch.reserving : PC.batch.reserve}
                </Button>
              </div>
              {reserveWhy && action !== 'reserve' && reserveWhy !== PC.form.busy ? <p className="text-xs text-muted-foreground">{reserveWhy}</p> : null}
            </section>
          </div>

          <BatchPage
            key={current}
            id={current}
            reviewed={isBatchReviewed(current, reviews, rows)}
            closeRefused={refused > shownRefusal}
            onReview={(revision) =>
              setReviews((r) => {
                const next = { ...r };
                if (revision === null) delete next[current];
                else next[current] = revision;
                return next;
              })
            }
            onState={onState}
            onReplace={(next) => setIds((list) => replaceId(list, current, next))}
          />

          <div className="sticky -bottom-6 z-10 -mx-2 space-y-2 rounded-2xl border-t border-foreground/10 bg-popover p-4 shadow-(--glass-shadow) sm:mx-0">
            {notice ? (
              <div role={notice.tone === 'error' ? 'alert' : 'status'} className="space-y-1 text-sm">
                <p className={cn('whitespace-pre-wrap', notice.tone === 'error' ? 'text-destructive' : 'text-foreground')}>{notice.text}</p>
                {notice.lines?.length ? (
                  <ul className="list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">
                    {notice.lines.map((line, i) => (
                      <li key={`${i}:${line}`}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">{sendWhy ?? PC.batch.reviewHint}</span>
              <Button type="button" variant="outline" disabled={!!sendWhy} onClick={() => void deliver('authorize')}>
                {PC.batch.approveAgent}
              </Button>
              <Button type="button" disabled={!!sendWhy} onClick={() => void deliver('send')}>
                {action === 'send' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Send aria-hidden />}
                {action === 'send' ? PC.batch.sending : PC.batch.send(ids.length)}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** One publication of the batch in the shared form, with the batch's own footer. Reports whether it has unsaved edits or a write running. */
function BatchPage({
  id,
  reviewed,
  closeRefused,
  onReview,
  onState,
  onReplace,
}: {
  id: Id;
  reviewed: boolean;
  closeRefused: boolean;
  /** The revision the owner ticked "Reviewed this publication" for, or null to untick. */
  onReview: (revision: number | null) => void;
  onState: (state: { dirty: boolean; busy: boolean }) => void;
  onReplace: (id: Id) => void;
}) {
  const load = usePublicationForm(id, onReplace);
  const form = load.kind === 'ready' ? load.form : null;
  const dirty = !!form?.dirty;
  const busy = !!form?.busy;
  useEffect(() => onState({ dirty, busy }), [onState, dirty, busy]);
  useEffect(() => () => onState({ dirty: false, busy: false }), [onState]);

  if (load.kind === 'loading') {
    return (
      <div role="status" aria-label={PC.form.loading} className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }
  if (load.kind === 'failed') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {PC.form.loadFailed(load.message)}
      </p>
    );
  }
  return (
    <PublicationForm
      form={load.form}
      footer={<BatchItemFooter form={load.form} reviewed={reviewed} closeRefused={closeRefused} onReview={onReview} />}
    />
  );
}

/** Save / Discard (with Undo), readiness, and "Reviewed this publication" for the publication on screen. */
function BatchItemFooter({
  form,
  reviewed,
  closeRefused,
  onReview,
}: {
  form: PublicationFormApi;
  reviewed: boolean;
  closeRefused: boolean;
  onReview: (revision: number | null) => void;
}) {
  const runtime = useRuntime();
  const { saved, state, notice } = form;
  const reviewWhy = form.busy ? PC.form.busy : form.dirty ? PC.batch.reviewFirst : !form.owner ? PC.form.webOnly : form.readOnly ? PC.form.readOnly : null;

  const discard = () => {
    const draft = state.draft!;
    const revision = saved.revision;
    form.dispatch({ type: 'discard' });
    form.setNotice({
      tone: 'status',
      text: PC.form.discarded,
      undo: {
        label: PC.form.undoDiscard,
        run: () => {
          form.dispatch({ type: 'restore', draft, revision });
          form.setNotice(null);
        },
      },
    });
  };
  const readiness = async () => {
    form.setNotice(null);
    try {
      const issues = await publicationReadiness(runtime, saved.id);
      form.setNotice(issues.length ? { tone: 'error', text: PC.form.hasIssues, issues } : { tone: 'status', text: PC.form.ready });
    } catch (e) {
      form.setNotice({ tone: 'error', text: publishingError(e).message });
    }
  };

  return (
    <div className="space-y-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={!form.dirty || form.busy || form.readOnly} onClick={() => void form.save()}>
          {PC.form.save}
        </Button>
        {form.dirty ? (
          <Button type="button" variant="ghost" disabled={form.busy} onClick={discard}>
            {PC.form.discard}
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="ms-auto" disabled={form.busy || form.dirty} title={form.dirty ? PC.form.needsSave : undefined} onClick={() => void readiness()}>
          <ListChecks aria-hidden />
          {PC.form.readiness}
        </Button>
      </div>
      {form.dirty ? (
        <p role="status" className={cn('text-xs', closeRefused ? 'font-medium text-primary' : 'text-muted-foreground')}>
          {PC.form.saveOrDiscard}
        </p>
      ) : null}
      {notice ? (
        <div role={notice.tone === 'error' ? 'alert' : 'status'} className="space-y-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('min-w-0 flex-1 whitespace-pre-wrap', notice.tone === 'error' ? 'text-destructive' : 'text-foreground')}>{notice.text}</p>
            {notice.undo ? (
              <Button type="button" size="sm" variant="outline" onClick={notice.undo.run}>
                <Undo2 aria-hidden />
                {notice.undo.label}
              </Button>
            ) : null}
          </div>
          {notice.issues?.length ? (
            <ul className="list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">
              {notice.issues.map((issue, i) => (
                <li key={`${issue.code}:${issue.destinationId ?? ''}:${i}`}>{issueText(issue)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <Checkbox checked={reviewed} disabled={!!reviewWhy} onCheckedChange={(checked) => onReview(checked ? saved.revision : null)}>
        {PC.batch.reviewed}
      </Checkbox>
      {/* The batch bar already says why a browser session cannot send; repeat only the reasons that are about this page. */}
      {reviewWhy && reviewWhy !== PC.form.busy && reviewWhy !== PC.form.webOnly ? <p className="text-xs text-muted-foreground">{reviewWhy}</p> : null}
    </div>
  );
}
