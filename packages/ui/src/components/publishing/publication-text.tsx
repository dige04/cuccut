'use client';

import { useId, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { composeCaption, type Id } from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Input } from '../../cc/ui/input';
import { Textarea } from '../../cc/ui/textarea';
import { jobErrorText } from '../../model/localized-text.ts';
import { proposalStale, proposeBlock, withProposal, type ProposalPart } from '../../model/publication-sections.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { applyCopy, proposeCopy, publishingError } from '../../runtime/publishing-commands.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import type { PublicationFormApi } from './publication-form.tsx';
import { PC } from './publishing-copy.ts';

/**
 * The "Shared text" tab (design §2.4): YouTube title, description and hashtags shared by every account, "Propose text" (a text-model job), and the
 * proposal card, which never applies itself: "Use title / description / hashtags / all" each save that part.
 */
export function PublicationText({ form }: { form: PublicationFormApi }) {
  const id = useId();
  const runtime = useRuntime();
  const { draft, saved } = form;
  const [jobId, setJobId] = useState<Id | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const job = useJobs((s) => (jobId ? (s.jobs.find((j) => j.jobId === jobId) ?? null) : null));
  const proposing = !!jobId && (!job || isJobLive(job));
  const jobError = job && !isJobLive(job) && job.state !== 'completed' ? (jobErrorText(job.error) ?? job.state) : null;
  const editBlock = form.locked ? PC.form.locked : form.readOnly ? PC.form.readOnly : null;
  const block = proposeBlock(form) ?? (proposing ? PC.form.proposing : null);
  const proposal = saved.proposal && saved.proposal.at !== dismissed ? saved.proposal : null;
  const edit = (text: Partial<typeof draft.text>) => form.dispatch({ type: 'edit', patch: { text } });

  const propose = async () => {
    form.setNotice(null);
    try {
      setJobId((await proposeCopy(runtime, saved.id)).jobId);
    } catch (e) {
      form.setNotice({ tone: 'error', text: publishingError(e).message });
    }
  };
  const use = (part: ProposalPart) => {
    if (!proposal) return;
    void form.act(() => applyCopy(runtime, saved.id, saved.revision, withProposal(saved.copy, proposal.copy, part)), PC.form.saved);
  };

  return (
    <fieldset disabled={!!editBlock} className="min-w-0 space-y-4">
      <p className="text-xs text-muted-foreground">{PC.form.sharedHint}</p>
      <div className="space-y-1.5 text-sm">
        <label htmlFor={`${id}-title`}>{PC.form.youtubeTitle}</label>
        <Input id={`${id}-title`} value={draft.text.title} onChange={(e) => edit({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5 text-sm">
        <label htmlFor={`${id}-description`}>{PC.form.description}</label>
        <Textarea id={`${id}-description`} rows={4} className="min-h-28" value={draft.text.description} onChange={(e) => edit({ description: e.target.value })} />
      </div>
      <div className="space-y-1.5 text-sm">
        <label htmlFor={`${id}-hashtags`}>{PC.form.hashtags}</label>
        <Input
          id={`${id}-hashtags`}
          value={draft.text.hashtags}
          aria-describedby={`${id}-hashtags-hint`}
          onChange={(e) => edit({ hashtags: e.target.value })}
        />
        <p id={`${id}-hashtags-hint`} className="text-xs text-muted-foreground">
          {PC.form.hashtagsHint}
        </p>
      </div>
      {editBlock ? <p className="text-xs text-muted-foreground">{editBlock}</p> : null}
      <div className="space-y-1.5">
        <Button type="button" variant="outline" disabled={!!block} onClick={() => void propose()}>
          {proposing ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Sparkles aria-hidden />}
          {proposing ? PC.form.proposing : PC.form.proposeText}
        </Button>
        {block && !proposing && !editBlock ? <p className="text-xs text-muted-foreground">{block}</p> : null}
        {jobError ? (
          <p role="alert" className="text-sm text-destructive">
            {PC.form.proposeFailed(jobError)}
          </p>
        ) : null}
      </div>
      {proposal ? (
        <section aria-labelledby={`${id}-proposal`} className="space-y-3 rounded-2xl bg-foreground/5 p-4">
          <h4 id={`${id}-proposal`} className="text-xs font-medium text-muted-foreground">
            {PC.form.proposal}
          </h4>
          {proposalStale(saved) ? <p className="text-xs text-muted-foreground">{PC.form.proposalStale}</p> : null}
          <p className="text-sm font-medium text-foreground">{proposal.copy.title}</p>
          <p className="text-sm whitespace-pre-wrap text-foreground">{composeCaption(proposal.copy)}</p>
          <p className="text-xs text-muted-foreground">{proposal.reason}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!!proposeBlock(form)} onClick={() => use('title')}>
              {PC.form.useTitle}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!!proposeBlock(form)} onClick={() => use('description')}>
              {PC.form.useDescription}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!!proposeBlock(form)} onClick={() => use('hashtags')}>
              {PC.form.useHashtags}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!!proposeBlock(form)} onClick={() => use('all')}>
              {PC.form.useAll}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDismissed(proposal.at)}>
              {PC.form.dismissProposal}
            </Button>
          </div>
          {proposeBlock(form) ? <p className="text-xs text-muted-foreground">{proposeBlock(form)}</p> : null}
        </section>
      ) : null}
    </fieldset>
  );
}
