import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Id, ReviewCriteriaView, ReviewDecisionResult, ReviewResult, ReviewSeverity, ReviewVerdict } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { CircleAlert, CircleCheck, CircleHelp, CircleX, Loader2, MessageSquare, ShieldCheck } from 'lucide-react';
import { Button } from '../../cc/ui/button.tsx';
import { Card, CardContent } from '../../cc/ui/card.tsx';
import { Disclosure } from '../../cc/ui/disclosure.tsx';
import { homeGate } from '../../model/home-brief.ts';
import { groupFindings, isStale, type ReviewFinding } from '../../model/review.ts';
import { rubricHandoff } from '../../model/review-rubric.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { useReview, type ReviewBusy } from '../../state/review-store.ts';
import { routeVideo, useShell } from '../../state/shell-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { targetKey } from '../../model/workspace.ts';
import { handToAgent, showConversation } from '../editor/ai-tools-handoff.ts';
import { ReviewFindingCard, type FindingActions } from './review-finding.tsx';
import { REVIEW_COPY as C } from './review-copy.ts';

/**
 * What this video is held to, and what came of it (docs/cuccut/m2-review-gate.md §2.1; agentcut's review-panel.tsx).
 *
 * Every control here calls what the agent's tools call (`review.run`, `review.waive`, `review.unwaive`,
 * `review.severity`), so the standard has one implementation and two ways in. A finding is never hidden: letting one
 * stand keeps it on the list with the reason beside it. Decisions are edits of the video: they sit on the editor's undo
 * stack, and the toast after each offers Undo.
 */

const VERDICT_ICON: Record<ReviewVerdict, ReactNode> = {
  passed: <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />,
  'passed-with-findings': <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />,
  failed: <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />,
  'not-reviewed': <CircleHelp aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />,
};

const VERDICT_TEXT = (verdict: ReviewVerdict): string =>
  verdict === 'passed'
    ? C.verdict.passed
    : verdict === 'passed-with-findings'
      ? C.verdict.findings
      : verdict === 'failed'
        ? C.verdict.failed
        : C.verdict.notReviewed;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function ReviewPanel({ videoId, sequenceId }: { videoId: Id; sequenceId: Id | null }) {
  const runtime = useRuntime();
  const full = useReview((s) => s.full[videoId]);
  const busy = useReview((s) => s.busy[videoId] ?? null);
  const asking = useReview((s) => s.asking[videoId] ?? null);
  const criteriaRevision = useReview((s) => s.criteria?.revision ?? null);
  const video = useVideo((s) => (s.video?.videoId === videoId ? s.video : null));
  const revision = video?.state?.video.revision ?? null;
  const editable = canEdit(video);
  const [view, setView] = useState<ReviewCriteriaView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = sequenceId ?? undefined;

  // The standard active for this video, with its decisions: read again when the standard or the video changes.
  useEffect(() => {
    let cancelled = false;
    runtime.reviewCriteria(videoId).then(
      (next) => !cancelled && setView(next),
      (reason: unknown) => !cancelled && setError(message(reason)),
    );
    return () => {
      cancelled = true;
    };
  }, [runtime, videoId, criteriaRevision, revision]);

  // The stored result; the session keeps it fresh from the `review` topic while it is held.
  useEffect(() => {
    void runtime.reviewGet(videoId).catch((reason: unknown) => setError(message(reason)));
  }, [runtime, videoId]);

  const act = async (label: ReviewBusy, call: () => Promise<unknown>) => {
    const store = useReview.getState();
    if (store.busy[videoId]) return;
    store.setBusy(videoId, label);
    setError(null);
    try {
      await call();
    } catch (reason) {
      setError(message(reason));
    } finally {
      useReview.getState().setBusy(videoId, null);
    }
  };

  const check = () => act('run', () => runtime.reviewRun(videoId, seq));

  const actions = (finding: ReviewFinding): FindingActions => ({
    onWaive: (reason) =>
      void act(`waive:${finding.id}`, async () => {
        const decided = await runtime.reviewWaive(videoId, finding.id, reason);
        offerUndo(runtime, videoId, seq, decided, C.waivedToast(finding.name));
      }),
    onUnwaive: () =>
      void act(`unwaive:${finding.id}`, async () => {
        const decided = await runtime.reviewUnwaive(videoId, finding.id);
        offerUndo(runtime, videoId, seq, decided, C.unwaivedToast(finding.name));
      }),
    onSeverity: (severity, reason) =>
      void act(`severity:${finding.id}`, async () => {
        const decided = await runtime.reviewSeverity(videoId, finding.id, severity, reason);
        const now = decided.result.checks.find((c) => c.id === finding.id)?.severity ?? decided.result.rubric.find((r) => r.id === finding.id)?.severity;
        offerUndo(runtime, videoId, seq, decided, C.severityToast(finding.name, C.severityLower[now ?? severity ?? finding.severity]));
      }),
  });

  if (!view && !error) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
        {C.loading}
      </p>
    );
  }

  const locked = editable ? null : C.decisionsLocked;
  const standardOf = (id: string): ReviewSeverity | undefined =>
    view?.checks.find((c) => c.id === id)?.severity ?? view?.rubric.find((q) => q.id === id)?.severity;

  return (
    <div className="flex flex-col gap-4 text-sm">
      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
          {error}
        </p>
      ) : null}

      {view ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs leading-relaxed text-muted-foreground">{view.source === 'user' ? C.reasonUser : C.reasonBuiltin}</p>
          <p className="text-xs text-muted-foreground">{C.counts(view.checks.length, view.rubric.length)}</p>
        </div>
      ) : null}

      <ReviewActions
        videoId={videoId}
        busy={busy}
        questions={view?.rubric.length ?? 0}
        editable={editable}
        asking={asking?.conversationId ?? null}
        onCheck={() => void check()}
      />

      {full === undefined ? null : full === null ? (
        <p className="text-muted-foreground">{C.notChecked}</p>
      ) : (
        <ReviewOutcome
          result={full}
          revision={revision}
          busy={busy}
          locked={locked}
          standardOf={standardOf}
          actions={actions}
        />
      )}
    </div>
  );
}

/** Undo in the toast (destructive actions act and offer Undo): undoes the decision's edit, then checks again so the result follows. */
function offerUndo(runtime: RuntimeSession, videoId: Id, sequenceId: Id | undefined, decided: ReviewDecisionResult, text: string): void {
  ToastQueue.neutral(text, {
    timeout: 6000,
    actionLabel: C.undo,
    shouldCloseOnAction: true,
    onAction: () =>
      void (async () => {
        const receipt = await runtime.videos.undo({ transaction: decided.receipt.transactionId });
        // The Runtime's copy of the video follows the engine's events: the check waits for the undo's revision.
        if (receipt) await runtime.reviewRun(videoId, sequenceId, receipt.videoRevision);
      })().catch((error: unknown) => ToastQueue.negative(C.failed(message(error)), { timeout: 5000 })),
  });
}

/** Check this video (the one tinted action), and ask the questions when the standard has any. */
function ReviewActions({
  videoId,
  busy,
  questions,
  editable,
  asking,
  onCheck,
}: {
  videoId: Id;
  busy: ReviewBusy | null;
  questions: number;
  editable: boolean;
  asking: Id | null;
  onCheck(): void;
}) {
  const runtime = useRuntime();
  const drivers = useConnection((s) => s.drivers);
  const checking = useConnection((s) => s.checking);
  const conversations = useDirectory((s) => s.conversations);
  const ref = useVideo((s) => (s.video?.videoId === videoId ? s.video.ref : null));
  const current = useShell((s) => {
    if (s.route.tab === 'home') return s.route.conversationId;
    const shown = routeVideo(s.route);
    return s.route.tab === 'space' && shown ? (s.videoChats[targetKey(shown)] ?? null) : null;
  });
  const agentReady = homeGate(drivers, checking)?.ok === true;
  const askBlocked = !agentReady ? C.askNeedsAgent : !editable ? C.askNeedsEdit : null;

  const ask = async () => {
    const store = useReview.getState();
    if (store.busy[videoId]) return;
    store.setBusy(videoId, 'ask');
    try {
      const plan = rubricHandoff({ videoId, video: ref, current, conversations });
      const handed = await handToAgent(runtime, { video: ref, session: plan.session, text: plan.text, attachments: [], skills: [], draftKey: plan.draftKey, stay: true });
      if (handed && !handed.drafted) useReview.getState().setAsking(videoId, { conversationId: handed.conversationId, since: handed.handedAt });
    } finally {
      useReview.getState().setBusy(videoId, null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy !== null} onClick={onCheck}>
          {busy === 'run' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <ShieldCheck aria-hidden />}
          {C.check}
        </Button>
        {/* Re-asking is a second click: while answers are awaited the button asks again, so a turn that ended without them never leaves it stuck. */}
        {questions ? (
          <Button size="sm" variant="outline" disabled={busy !== null || askBlocked !== null} title={askBlocked ?? undefined} onClick={() => void ask()}>
            {busy === 'ask' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <CircleHelp aria-hidden />}
            {busy === 'ask' ? C.asking : asking ? C.askAgain : C.ask}
          </Button>
        ) : null}
      </div>
      {questions && askBlocked && !asking ? (
        <p className="text-xs text-muted-foreground">{askBlocked}</p>
      ) : null}
      {asking ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 aria-hidden className="size-3 motion-safe:animate-spin" />
          {C.askingNote}
          <Button variant="link" size="xs" className="h-auto px-0" onClick={() => showConversation(asking)}>
            <MessageSquare aria-hidden />
            {C.openConversation}
          </Button>
          <Button variant="link" size="xs" className="h-auto px-0" onClick={() => useReview.getState().setAsking(videoId, null)}>
            {C.stopWaiting}
          </Button>
        </p>
      ) : null}
    </div>
  );
}

/** The verdict banner and the findings, grouped: to answer for, let stand, what it holds to, what was not read. */
function ReviewOutcome({
  result,
  revision,
  busy,
  locked,
  standardOf,
  actions,
}: {
  result: ReviewResult;
  revision: string | null;
  busy: ReviewBusy | null;
  locked: string | null;
  standardOf(id: string): ReviewSeverity | undefined;
  actions(finding: ReviewFinding): FindingActions;
}) {
  const groups = useMemo(() => groupFindings(result), [result]);
  const stale = isStale(result, revision);
  const notes = [
    stale.project ? C.staleProject : null,
    stale.export && result.measured.export ? C.staleExport(result.measured.export.revision) : null,
    stale.answers ? C.staleAnswers : null,
  ].filter((n): n is string => n !== null);

  return (
    <>
      {/* The verdict is a status: a neutral card, the icon carries the colour, the accent stays on the action. */}
      <Card size="sm" role="status">
        <CardContent className="flex items-start gap-2">
          {VERDICT_ICON[result.verdict]}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm text-foreground">{VERDICT_TEXT(result.verdict)}</p>
            {/* A verdict that holds with findings let stand says so: "it holds" alone would read as nothing was found. */}
            {groups.waived.length ? <p className="text-xs text-foreground/85">{C.letStandCount(groups.waived.length)}</p> : null}
            <p className="text-xs text-muted-foreground">{C.readFrom(result.stages.includes('export'), result.stages.includes('rubric'))}</p>
            {notes.map((note) => (
              <p key={note} className="text-xs text-warning">
                {note}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {locked && (groups.open.length || groups.waived.length) ? <p className="text-xs text-muted-foreground">{locked}</p> : null}

      {groups.open.length ? (
        <section className="flex flex-col gap-2" aria-label={C.groups.open}>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{C.groups.open}</h3>
          <ul className="flex flex-col gap-2">
            {groups.open.map((finding) => (
              <ReviewFindingCard
                key={finding.id}
                finding={finding}
                standard={standardOf(finding.id)}
                busy={busy}
                locked={locked}
                actions={actions(finding)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.waived.length ? (
        <section className="flex flex-col gap-2" aria-label={C.groups.waived}>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{C.groups.waived}</h3>
          <ul className="flex flex-col gap-2">
            {groups.waived.map((finding) => (
              <ReviewFindingCard
                key={finding.id}
                finding={finding}
                standard={standardOf(finding.id)}
                busy={busy}
                locked={locked}
                actions={actions(finding)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.holds.length ? (
        <Disclosure summary={C.groups.holds(groups.holds.length)}>
          <ul className="flex flex-col gap-1">
            {groups.holds.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CircleCheck aria-hidden className="mt-0.5 size-3 shrink-0 text-success" />
                <span>
                  {f.said} — {f.detail}
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      {groups.skipped.length ? (
        <Disclosure summary={C.groups.skipped(groups.skipped.length)}>
          <ul className="flex flex-col gap-1">
            {groups.skipped.map((s) => (
              <li key={s.id} className="text-xs text-muted-foreground">
                <span className="font-mono">{s.id}</span> — {s.why}
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </>
  );
}
