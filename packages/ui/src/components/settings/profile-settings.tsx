import { useId, useRef, useState, type FormEvent } from 'react';
import { INTERVIEW_QUESTIONS, type InterviewAnswers, type ProfileSnapshot, type ProfileWriteResult } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { Loader2, MessageSquareText, NotebookPen, Sparkles, WandSparkles } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '../../cc/ui/button.tsx';
import { Label } from '../../cc/ui/label.tsx';
import { Textarea } from '../../cc/ui/textarea.tsx';
import { answerCount, canWriteAnswers, changedAnswers, hasWriterAgent, interviewLine, isRequiredQuestion } from '../../model/profile.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { removeInterviewSection, saveAnswers, setPreferences, writeFromAnswers } from '../../runtime/profile-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useProfile } from '../../state/profile-store.ts';
import { PROFILE_COPY } from '../profile/profile-copy.ts';
import { ErrorLine, LockNote, ProfileSkeleton, errorText, undoToast, useProfileLock } from '../profile/profile-parts.tsx';
import { Panel, PanelHeading } from './settings-ui.tsx';

const C = () => PROFILE_COPY;

/**
 * Settings › You (docs/cuccut/m2-profile-rules.md §2.1, agentcut `profile-view.tsx`, pixel target `docs/cuccut/reference/settings.png`): the
 * interview's answers, editable where they can be read; the user's own preferences; and the section the interview wrote, kept apart so neither
 * overwrites the other. Everything here reaches agents in sessions that start after it is saved.
 */
export function ProfileSettings() {
  const snapshot = useProfile((s) => s.snapshot);
  const lock = useProfileLock();
  if (!snapshot) return <ProfileSkeleton label={C().loading} panels={2} />;
  return (
    <div data-cc className="flex flex-col gap-5">
      <AboutYou snapshot={snapshot} lock={lock} />
      <OwnPreferences own={snapshot.preferences.own} lock={lock} />
      {snapshot.preferences.interview ? <InterviewSection text={snapshot.preferences.interview} lock={lock} /> : null}
      <p className="m-0 max-w-prose text-xs text-muted-foreground">{C().note.sessions}</p>
    </div>
  );
}

/**
 * Text being edited over a saved value that can change under it (the topic sends every save, also the agent's): while the field is untouched it
 * follows the saved value; once typed in, it keeps what was typed until it is saved or discarded.
 */
function useDraft<T>(saved: T, same: (a: T, b: T) => boolean): [T, (next: T) => void] {
  const [draft, setDraft] = useState(saved);
  const [base, setBase] = useState(saved);
  if (!same(base, saved)) {
    setBase(saved);
    if (same(draft, base)) setDraft(saved);
  }
  return [draft, setDraft];
}

const sameAnswers = (a: InterviewAnswers, b: InterviewAnswers) => Object.keys(changedAnswers(a, b)).length === 0;
const sameText = (a: string, b: string) => a === b;

/** The five questions on one panel: the full-screen interview asks them one at a time; here they are fields, because the second time you know them. */
function AboutYou({ snapshot, lock }: { snapshot: ProfileSnapshot; lock: string | null }) {
  const runtime = useRuntime();
  const id = useId();
  const { interview, preferences } = snapshot;
  const [draft, setDraft] = useDraft(interview.answers, sameAnswers);
  const [busy, setBusy] = useState<'save' | 'rewrite' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const writing = useProfile((s) => s.writing);
  const agent = useConnection((s) => hasWriterAgent(s.drivers));

  const changed = changedAnswers(draft, interview.answers);
  const dirty = Object.keys(changed).length > 0;
  const answered = answerCount(draft);
  const canWrite = canWriteAnswers(draft);
  const disabled = !!lock || busy !== null;

  const fail = (message: string) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!dirty || disabled) return;
    setBusy('save');
    setError(null);
    try {
      await saveAnswers(runtime, changed);
      ToastQueue.positive(C().answers.saved, { timeout: 3000 });
    } catch (err) {
      fail(C().answers.saveFailed(errorText(err)));
    } finally {
      setBusy(null);
    }
  };

  const rewrite = async () => {
    if (!canWrite || disabled || writing) return;
    setBusy('rewrite');
    setError(null);
    try {
      // The answers on screen are what gets written: save them first, so a failed write still keeps them.
      if (dirty) await saveAnswers(runtime, changed);
      announceWrite(await writeFromAnswers(runtime));
    } catch (err) {
      fail(C().answers.writeFailed(errorText(err)));
    } finally {
      setBusy(null);
    }
  };

  // Why "Rewrite my preferences" is off, or what it will do: one hint, the most pressing first.
  const lastLine = writing?.lines.at(-1);
  // Locked, the reason already sits above the fields, so the hint only counts.
  const hint = writing
    ? C().answers.writing
    : !lock && !canWrite
      ? C().answers.needWho
      : !lock && agent === false
        ? C().answers.noAgent
        : C().answers.count(answered, INTERVIEW_QUESTIONS.length);
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-2">
      <Panel label={C().about.title}>
        <form className="flex flex-col gap-4" onSubmit={(event) => void save(event)}>
          <PanelHeading
            title={C().about.title}
            icon={<MessageSquareText />}
            hint={interviewLine(interview.status, !!preferences.interview)}
          />
          <LockNote>{lock}</LockNote>
          <div className="grid gap-4 @xl:grid-cols-2">
            {INTERVIEW_QUESTIONS.map((question) => {
              const fieldId = `${id}-${question}`;
              const copy = C().question[question];
              return (
                <div key={question} className={cn('flex min-w-0 flex-col gap-1.5', question === 'who' && '@xl:col-span-2')}>
                  <Label htmlFor={fieldId} className="leading-snug">
                    <span>
                      {copy.label}
                      {isRequiredQuestion(question) ? null : <span className="font-normal text-muted-foreground"> {C().question.optional}</span>}
                    </span>
                  </Label>
                  <Textarea
                    id={fieldId}
                    rows={question === 'who' ? 3 : 2}
                    value={draft[question] ?? ''}
                    placeholder={copy.placeholder}
                    disabled={!!lock}
                    onChange={(event) => setDraft({ ...draft, [question]: event.target.value })}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="secondary" size="sm" disabled={!dirty || disabled}>
              {busy === 'save' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
              {C().answers.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canWrite || disabled || !!writing}
              aria-describedby={hint ? hintId : undefined}
              onClick={() => void rewrite()}>
              {busy === 'rewrite' || writing ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <WandSparkles aria-hidden />}
              {C().answers.rewrite}
            </Button>
            {hint ? (
              <span id={hintId} aria-live="polite" className="min-w-0 text-xs text-muted-foreground">
                {hint}
                {writing && lastLine ? <span className="mt-0.5 block truncate font-mono text-[0.7rem] text-muted-foreground/80">{lastLine}</span> : null}
              </span>
            ) : null}
          </div>
        </form>
      </Panel>
      <ErrorLine ref={errorRef}>{error}</ErrorLine>
    </div>
  );
}

/** What a finished write says: written by the agent, or kept as typed and why; and the names it put in the glossary. */
function announceWrite(result: ProfileWriteResult): void {
  const names = result.names.length ? ` ${C().answers.namesAdded(result.names.join(', '))}` : '';
  if (result.fallbackReason) ToastQueue.info(`${C().fallback[result.fallbackReason]}${names}`, { timeout: 8000 });
  else ToastQueue.positive(`${C().answers.written}${names}`, { timeout: 6000 });
}

/** The user's own lines. "Save preferences" is the view's one tinted action, and only while there is something to save. */
function OwnPreferences({ own, lock }: { own: string; lock: string | null }) {
  const runtime = useRuntime();
  const id = useId();
  const [draft, setDraft] = useDraft(own, sameText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dirty = draft !== own;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || busy || lock) return;
    setBusy(true);
    setError(null);
    try {
      await setPreferences(runtime, { own: draft });
      ToastQueue.positive(C().own.saved, { timeout: 3000 });
    } catch (err) {
      setError(C().own.saveFailed(errorText(err)));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Panel label={C().own.title}>
        <form className="flex flex-col gap-3" onSubmit={(event) => void save(event)}>
          <PanelHeading title={C().own.title} icon={<NotebookPen />} hint={C().own.blurb} />
          <Textarea
            id={`${id}-own`}
            rows={8}
            aria-label={C().own.label}
            className="font-mono text-xs leading-relaxed md:text-xs"
            value={draft}
            placeholder={C().own.placeholder}
            disabled={!!lock}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant={dirty && !lock ? 'default' : 'secondary'} size="sm" disabled={!dirty || busy || !!lock}>
              {busy ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
              {C().own.save}
            </Button>
            {dirty ? (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setDraft(own)}>
                {C().own.discard}
              </Button>
            ) : null}
          </div>
        </form>
      </Panel>
      <ErrorLine ref={errorRef}>{error}</ErrorLine>
    </div>
  );
}

/** The section the interview wrote: read here, rewritten from the answers above, or removed at once with Undo. */
function InterviewSection({ text, lock }: { text: string; lock: string | null }) {
  const runtime = useRuntime();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const { undo } = await removeInterviewSection(runtime);
      undoToast(C().interviewSection.removed, undo);
    } catch (err) {
      setError(C().interviewSection.removeFailed(errorText(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Panel label={C().interviewSection.title} className="flex flex-col gap-3">
        <PanelHeading
          title={C().interviewSection.title}
          icon={<Sparkles />}
          hint={C().interviewSection.blurb}
          action={
            <Button type="button" variant="ghost" size="sm" disabled={busy || !!lock} onClick={() => void remove()}>
              {C().interviewSection.remove}
            </Button>
          }
        />
        {/* It scrolls, so it is focusable: a region a keyboard can't scroll is one a keyboard user can't read to the end. */}
        <pre
          tabIndex={0}
          role="region"
          aria-label={C().interviewSection.regionLabel}
          className="m-0 max-h-64 overflow-auto rounded-xl bg-foreground/[0.04] p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {text}
        </pre>
      </Panel>
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}
