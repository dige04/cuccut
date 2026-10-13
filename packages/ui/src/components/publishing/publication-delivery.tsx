'use client';

import { useId, useState } from 'react';
import { ClipboardCopy, ExternalLink, FolderOpen, Hand, Undo2 } from 'lucide-react';
import {
  FORMAT_NETWORK,
  intendedTime,
  intlLocale,
  localizeText,
  RECONCILE_STATES,
  type PublicationDestination,
  type PublishingNetwork,
  type ReconcileState,
} from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Disclosure } from '../../cc/ui/disclosure';
import { Input } from '../../cc/ui/input';
import { Textarea } from '../../cc/ui/textarea';
import {
  canWithdraw,
  EMPTY_RECORD,
  formatInstant,
  handoverText,
  pinnedExportPath,
  recordable,
  recordBlock,
  recordParams,
  UPLOAD_URLS,
  type RecordDraft,
} from '../../model/publication-sections.ts';
import { destinationRoute, networkLabel } from '../../model/publishing-labels.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { preparePublications, publishingError, recordResult, withdrawDestination } from '../../runtime/publishing-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import type { PublicationFormApi } from './publication-form.tsx';
import { PublicationTimeField } from './publication-time-field.tsx';
import { PC } from './publishing-copy.ts';
import { PublishingSelect } from './publishing-select.tsx';
import { DeliveryBadge } from './status-badge.tsx';

const OBSERVED: Record<ReconcileState, () => string> = {
  published: () => PC.handover.observedPublished,
  scheduled: () => PC.handover.observedScheduled,
  cancelled: () => PC.handover.observedCancelled,
  not_sent: () => PC.handover.observedNotSent,
};

/**
 * The Delivery tab (design §2.4): one result card per destination (delivery badge, confirmed or published time, error, "Open published post",
 * Withdraw for one waiting for the owner), the by-hand posting kit (Reveal export, Copy caption, Open the network's upload page), and "Record a
 * result checked in the app". Once something was sent, "Prepare a new release" starts a new publication of the same video.
 */
export function PublicationDelivery({ form }: { form: PublicationFormApi }) {
  const runtime = useRuntime();
  const { saved } = form;
  const [preparing, setPreparing] = useState(false);
  const newRelease = async () => {
    setPreparing(true);
    form.setNotice(null);
    try {
      const [next] = await preparePublications(runtime, { videoIds: [saved.videoId], sequenceId: saved.sequenceId, repeat: true });
      if (next) form.openPublication(next.id);
    } catch (e) {
      form.setNotice({ tone: 'error', text: publishingError(e).message });
    } finally {
      setPreparing(false);
    }
  };
  const releaseBlock = form.busy ? PC.form.busy : form.dirty ? PC.form.needsSave : form.readOnly ? PC.form.readOnly : null;
  return (
    <div className="min-w-0 space-y-4">
      {!form.locked && !saved.destinations.some((d) => recordable(d) || d.state === 'published') ? (
        <p className="text-sm text-muted-foreground">{PC.handover.nothingSent}</p>
      ) : null}
      {saved.destinations.map((d) => (
        <DestinationResult key={d.id} form={form} destination={d} />
      ))}
      {form.locked ? (
        <div className="space-y-2 rounded-2xl bg-foreground/5 p-4">
          <p className="text-sm text-foreground">{PC.handover.lockedRelease}</p>
          <Button type="button" variant="outline" disabled={!!releaseBlock || preparing} onClick={() => void newRelease()}>
            {PC.form.newRelease}
          </Button>
          {releaseBlock ? <p className="text-xs text-muted-foreground">{releaseBlock}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function DestinationResult({ form, destination: d }: { form: PublicationFormApi; destination: PublicationDestination }) {
  const runtime = useRuntime();
  const { saved } = form;
  const route = destinationRoute(d.accountId, form.accounts, form.connections);
  const network = route?.account.network ?? FORMAT_NETWORK[d.format];
  const byHand = route?.byHand ?? true;
  const locale = intlLocale();
  const zone = saved.timezone;
  const actionBlock = form.busy ? PC.form.busy : form.dirty ? PC.form.needsSave : form.readOnly ? PC.form.readOnly : null;
  const error = d.error ? localizeText(d.error, d.errorRef) : null;
  return (
    <section aria-label={route ? `${route.account.name} · ${networkLabel(network)}` : networkLabel(network)} className="space-y-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">{route ? `${route.account.name} · ${networkLabel(network)}` : networkLabel(network)}</p>
        <DeliveryBadge state={d.state} network={network} byHand={byHand} hasTime={intendedTime(saved, d) !== null} />
      </div>
      {d.confirmedAt ? <p className="text-xs text-muted-foreground">{PC.handover.confirmedAt(formatInstant(d.confirmedAt, zone, locale))}</p> : null}
      {d.publishedAt ? <p className="text-xs text-muted-foreground">{PC.handover.publishedAt(formatInstant(d.publishedAt, zone, locale))}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {d.remoteUrl ? (
        <Button type="button" size="sm" variant="outline" onClick={() => openLink(runtime, d.remoteUrl!)}>
          <ExternalLink aria-hidden />
          {PC.handover.openPost}
        </Button>
      ) : null}
      {byHand && d.state === 'queued' ? <PostingKit form={form} destination={d} network={network} /> : null}
      {canWithdraw(d, byHand) ? (
        <div className="space-y-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!!actionBlock}
            onClick={() => void form.act(() => withdrawDestination(runtime, saved.id, saved.revision, d.id), PC.handover.withdrawn)}
          >
            <Undo2 aria-hidden />
            {PC.handover.withdraw}
          </Button>
          {actionBlock ? <p className="text-xs text-muted-foreground">{actionBlock}</p> : null}
        </div>
      ) : null}
      {recordable(d) ? <RecordResult form={form} destination={d} /> : null}
    </section>
  );
}

function openLink(runtime: ReturnType<typeof useRuntime>, url: string): void {
  if (runtime.host.openExternal) void runtime.host.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/** What the owner needs to post by hand: the pinned file, the caption (and title), and the network's upload page. */
function PostingKit({ form, destination: d, network }: { form: PublicationFormApi; destination: PublicationDestination; network: PublishingNetwork }) {
  const runtime = useRuntime();
  const home = useConnection((s) => (s.state.status === 'connected' ? s.state.runtime.home : null));
  const [copied, setCopied] = useState('');
  const text = handoverText(form.saved, d);
  const pinned = form.saved.export;
  const copy = async (value: string, done: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(done);
    } catch (e) {
      form.setNotice({ tone: 'error', text: (e as Error).message });
    }
  };
  return (
    <div className="space-y-3 rounded-2xl bg-foreground/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Hand aria-hidden className="size-4 text-primary" />
        {PC.handover.title}
      </p>
      <p className="text-xs text-muted-foreground">{PC.handover.lead}</p>
      <div className="flex flex-wrap gap-2">
        {form.owner && home && pinned ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void runtime.host.revealPath(pinnedExportPath(home, pinned.sha256))}>
            <FolderOpen aria-hidden />
            {PC.handover.reveal}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={() => void copy(text.caption, PC.handover.copied)}>
          <ClipboardCopy aria-hidden />
          {PC.handover.copyCaption}
        </Button>
        {network === 'youtube' && text.title ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void copy(text.title, PC.handover.titleCopied)}>
            <ClipboardCopy aria-hidden />
            {PC.handover.copyTitle}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={() => openLink(runtime, UPLOAD_URLS[network])}>
          <ExternalLink aria-hidden />
          {PC.handover.openUpload(networkLabel(network))}
        </Button>
      </div>
      {!form.owner ? <p className="text-xs text-muted-foreground">{PC.handover.revealUnavailable}</p> : null}
      <p role="status" className="text-xs text-muted-foreground">
        {copied}
      </p>
    </div>
  );
}

/** "Record a result checked in the app": what the owner saw in the network's app, with what they verified (desktop app only). */
function RecordResult({ form, destination: d }: { form: PublicationFormApi; destination: PublicationDestination }) {
  const id = useId();
  const runtime = useRuntime();
  const [draft, setDraft] = useState<RecordDraft>(EMPTY_RECORD);
  const block = recordBlock(draft, form);
  const submit = async () => {
    const saved = await form.act(() => recordResult(runtime, recordParams(form.saved, d.id, draft)), PC.handover.recorded);
    if (saved) setDraft(EMPTY_RECORD);
  };
  return (
    <Disclosure summary={PC.handover.record} variant="plain">
      <form
        className="space-y-3 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!block) void submit();
        }}
      >
        <div className="space-y-1.5 text-sm">
          <label htmlFor={`${id}-observed`}>{PC.handover.observed}</label>
          <PublishingSelect<ReconcileState>
            id={`${id}-observed`}
            value={draft.state}
            disabled={!form.owner}
            options={RECONCILE_STATES.map((state) => ({ value: state, label: OBSERVED[state]() }))}
            onChange={(state) => setDraft({ ...draft, state })}
          />
        </div>
        <PublicationTimeField
          label={PC.handover.observedAt}
          value={draft.at}
          timezone={form.saved.timezone}
          disabled={!form.owner}
          onChange={(at) => setDraft({ ...draft, at })}
        />
        <div className="space-y-1.5 text-sm">
          <label htmlFor={`${id}-link`}>{PC.handover.postLink}</label>
          <Input id={`${id}-link`} type="url" inputMode="url" value={draft.url} disabled={!form.owner} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
        </div>
        <div className="space-y-1.5 text-sm">
          <label htmlFor={`${id}-note`}>{PC.handover.verified}</label>
          <Textarea
            id={`${id}-note`}
            rows={2}
            value={draft.note}
            disabled={!form.owner}
            aria-describedby={`${id}-note-hint`}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <p id={`${id}-note-hint`} className="text-xs text-muted-foreground">
            {PC.handover.verifiedHint}
          </p>
        </div>
        <Button type="submit" variant="outline" disabled={!!block}>
          {PC.handover.recordSubmit}
        </Button>
        {block && block !== PC.handover.verifiedHint ? <p className="text-xs text-muted-foreground">{block}</p> : null}
      </form>
    </Disclosure>
  );
}
