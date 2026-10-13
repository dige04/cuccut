'use client';

import { useId } from 'react';
import { Archive, ListChecks, Send, Undo2 } from 'lucide-react';
import type { PublicationDetail } from '@cuccut/protocol';
import { cn } from 'cn';
import { Button } from '../../cc/ui/button';
import { Checkbox } from '../../cc/ui/checkbox';
import { isReviewed, primaryAction, primaryLabel, sendBlock } from '../../model/publication-form.ts';
import { issueText } from '../../model/publication-sections.ts';
import { useRuntime } from '../../runtime/context.tsx';
import {
  archivePublication,
  authorizeAgentDelivery,
  publicationReadiness,
  publishingError,
  sendPublication,
  usePublishingBusy,
} from '../../runtime/publishing-commands.ts';
import type { PublicationFormApi } from './publication-form.tsx';
import { PC } from './publishing-copy.ts';

/**
 * The dialog's footer (design §2.4): a full-width bar on the dialog's bottom edge, sticky from `lg` (on a phone it would cover half the dialog).
 * Save / Discard (Discard offers Undo), "Check publication readiness", the review checkbox (bound to this revision and pinned export), the one
 * tinted action — "Schedule publication", "Send now" or "Send" — and "Approve for agent delivery". Whatever is unavailable says why on the line
 * below.
 */
export function PublicationFooter({
  form,
  closeRefused = false,
  onArchived,
}: {
  form: PublicationFormApi;
  /** The owner tried to close while the draft is dirty: the save-or-discard hint stands out. */
  closeRefused?: boolean;
  onArchived?: (publication: PublicationDetail) => void;
}) {
  const id = useId();
  const runtime = useRuntime();
  const { saved, state, notice } = form;
  const running = usePublishingBusy((s) => s.busy[saved.id] ?? null);
  const block = sendBlock(state, { busy: form.busy, owner: form.owner }) ?? (form.readOnly ? PC.form.readOnly : null);
  const plainBlock = form.busy ? PC.form.busy : form.dirty ? PC.form.needsSave : form.readOnly ? PC.form.readOnly : null;

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
  const send = async () => {
    const sent = await form.act(() => sendPublication(runtime, saved.id, saved.revision), PC.form.sent);
    if (sent) form.setTab('delivery');
  };
  const archive = async () => {
    const archived = await form.act(() => archivePublication(runtime, saved.id, saved.revision));
    if (archived) onArchived?.(archived);
  };

  return (
    <div className="z-10 -mx-6 space-y-3 border-t border-foreground/10 bg-popover px-6 py-4 lg:sticky lg:bottom-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!form.dirty || form.busy || form.readOnly} onClick={() => void form.save()}>
            {running === 'update' ? PC.form.saving : PC.form.save}
          </Button>
          {form.dirty ? (
            <Button type="button" variant="ghost" disabled={form.busy} onClick={discard}>
              {PC.form.discard}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {onArchived ? (
            <Button type="button" variant="ghost" disabled={!!plainBlock} title={plainBlock ?? undefined} onClick={() => void archive()}>
              <Archive aria-hidden />
              {PC.form.archive}
            </Button>
          ) : null}
          <Button type="button" variant="outline" disabled={form.busy || form.dirty} title={form.dirty ? PC.form.needsSave : undefined} onClick={() => void readiness()}>
            <ListChecks aria-hidden />
            {PC.form.readiness}
          </Button>
        </div>
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
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          id={`${id}-review`}
          className="w-full text-xs"
          checked={isReviewed(state)}
          disabled={form.busy || form.dirty || !form.owner}
          onCheckedChange={(checked) => form.dispatch({ type: 'review', checked })}
        >
          {PC.form.review}
        </Checkbox>
        <Button type="button" disabled={!!block} onClick={() => void send()}>
          <Send aria-hidden />
          {running === 'send' ? PC.form.sending : primaryLabel(primaryAction(saved))}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!!block}
          onClick={() => void form.act(() => authorizeAgentDelivery(runtime, saved.id, saved.revision), PC.form.approvedAgent)}
        >
          {PC.form.approveAgent}
        </Button>
      </div>
      {block ? <p className="text-xs text-muted-foreground">{block}</p> : null}
    </div>
  );
}
