import { useId, useRef, useState, type ReactNode } from 'react';
import { INTERVIEW_QUESTIONS, type InterviewQuestionId, type ProfileWriteResult } from '@cuccut/protocol';
import { Loader2, Sparkles } from 'lucide-react';
import { RouteLink } from '../../cc/components/page-chrome.tsx';
import { Button, buttonVariants } from '../../cc/ui/button.tsx';
import { Textarea } from '../../cc/ui/textarea.tsx';
import { interviewCardView, showsInterviewCard } from '../../model/profile.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { saveAnswers, skipInterview, writeFromAnswers } from '../../runtime/profile-commands.ts';
import { useProfile } from '../../state/profile-store.ts';
import { WELCOME } from '../../state/shell-store.ts';
import { PROFILE_COPY } from '../profile/profile-copy.ts';
import { ErrorLine, errorText, useProfileLock } from '../profile/profile-parts.tsx';

const C = () => PROFILE_COPY.chat;

type Pending = 'save' | 'skip' | 'write' | null;

/**
 * The interview asked in passing, at the top of a conversation (docs/cuccut/m2-profile-rules.md §2.5, agentcut `onboarding-chat.tsx`): one
 * question at a time while the interview is pending and nothing has been told yet. It writes through the same commands as `/welcome` and
 * Settings › You, so a question answered here is gone from the others. It never blocks: the composer under the thread keeps working, "Ask me
 * later" moves on for this session only, and "Not now" ends it (Settings › You still has it).
 */
export function InterviewCard() {
  const runtime = useRuntime();
  const id = useId();
  const snapshot = useProfile((s) => s.snapshot);
  const writing = useProfile((s) => s.writing);
  const lock = useProfileLock();
  /** Questions put off in this session. Not saved: passing on one question is not a decision. */
  const [passed, setPassed] = useState<InterviewQuestionId[]>([]);
  /** The text typed for one question; another question starts empty. */
  const [draft, setDraft] = useState<{ question: InterviewQuestionId; text: string } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  /** Set once the preferences were written from here: the card stays for its one closing line, though the interview is now done. */
  const [written, setWritten] = useState<ProfileWriteResult | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  if (written) {
    return (
      <Card>
        <p role="status" className="m-0 flex items-start gap-2 text-sm text-muted-foreground">
          <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>{written.fallbackReason ? `${PROFILE_COPY.fallback[written.fallbackReason]} ${C().keptAsTyped}` : C().written}</span>
        </p>
      </Card>
    );
  }
  if (!snapshot || !showsInterviewCard(snapshot) || lock) return null;

  const view = interviewCardView(snapshot.interview.answers, passed);
  const busy = pending !== null || !!writing;

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<void>) => {
    setPending(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(C().failed(errorText(err)));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(null);
    }
  };

  const text = view.kind === 'ask' && draft?.question === view.question ? draft.text : '';

  const answer = () => {
    if (view.kind !== 'ask' || !text.trim() || busy) return;
    const question = view.question;
    void run('save', async () => {
      await saveAnswers(runtime, { [question]: text.trim() });
      setDraft(null);
    });
  };

  const notNow = () => void run('skip', async () => void (await skipInterview(runtime)));
  const write = () => void run('write', async () => setWritten(await writeFromAnswers(runtime)));

  const lead =
    view.kind === 'noRush' ? C().noRush : view.kind === 'finish' ? C().answered(view.answered, INTERVIEW_QUESTIONS.length) : C().lead;
  const fieldId = `${id}-answer`;
  const whyId = `${id}-why`;

  return (
    <Card label={C().label}>
      <p className="m-0 flex items-start gap-2 text-xs text-muted-foreground">
        <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <span>{lead}</span>
      </p>
      {writing || pending === 'write' ? (
        <p aria-live="polite" className="m-0 text-xs text-muted-foreground">
          {PROFILE_COPY.answers.writing}
          {writing?.lines.at(-1) ? <span className="mt-0.5 block truncate font-mono text-[0.7rem] text-muted-foreground/80">{writing.lines.at(-1)}</span> : null}
        </p>
      ) : null}
      {view.kind === 'ask' ? (
        <>
          <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
            {PROFILE_COPY.question[view.question].label}
          </label>
          <Textarea
            id={fieldId}
            rows={2}
            value={text}
            placeholder={PROFILE_COPY.question[view.question].placeholder}
            disabled={busy}
            onChange={(event) => setDraft({ question: view.question, text: event.target.value })}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              answer();
            }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="outline" size="xs" disabled={busy || !text.trim()} onClick={answer}>
              {pending === 'save' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
              {C().save}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setPassed([...passed, view.question]);
              }}>
              {C().later}
            </Button>
            <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={notNow}>
              {pending === 'skip' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
              {C().notNow}
            </Button>
            <RouteLink route={WELCOME} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
              {C().all}
            </RouteLink>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {view.kind === 'finish' ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={busy || !view.canWrite}
              aria-describedby={view.canWrite ? undefined : whyId}
              onClick={write}>
              {pending === 'write' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Sparkles aria-hidden />}
              {C().write}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={notNow}>
            {pending === 'skip' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
            {C().notNow}
          </Button>
          {view.kind === 'finish' && !view.canWrite ? (
            <span id={whyId} className="text-xs text-muted-foreground">
              {C().needWho}
            </span>
          ) : null}
        </div>
      )}
      <ErrorLine ref={errorRef}>{error}</ErrorLine>
    </Card>
  );
}

/** The card's surface: solid (content, not navigation), 24px, at the thread's reading width. */
function Card({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div data-cc className="mx-auto box-border w-full max-w-[760px] px-6 pt-4">
      <section aria-label={label} className="flex flex-col gap-2 rounded-3xl border border-border/60 bg-card p-4">
        {children}
      </section>
    </div>
  );
}
