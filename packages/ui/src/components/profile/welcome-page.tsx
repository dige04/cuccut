import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import type { InterviewAnswers, ProfileWriteResult } from '@cuccut/protocol';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { cn } from 'cn';
import { CucCutTile } from '../../cc/components/cuccut-mark.tsx';
import { Button } from '../../cc/ui/button.tsx';
import { Textarea } from '../../cc/ui/textarea.tsx';
import { changedAnswers, hasWriterAgent, welcomeStep } from '../../model/profile.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { saveAnswers, setPreferences, skipInterview, writeFromAnswers } from '../../runtime/profile-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useProfile } from '../../state/profile-store.ts';
import { HOME, useShell } from '../../state/shell-store.ts';
import { PROFILE_COPY } from './profile-copy.ts';
import { ErrorLine, LockNote, ProfileSkeleton, errorText, useProfileLock } from './profile-parts.tsx';

const C = () => PROFILE_COPY;

type Phase = 'asking' | 'writing' | 'review';
type Pending = 'save' | 'skip' | 'finish' | null;

/**
 * The interview, full screen on its own route (`/welcome`, docs/cuccut/m2-profile-rules.md §2.3, agentcut `welcome-view.tsx`). It is a different
 * job from making a video, so it gets the whole screen and no competing action; having a route means it can be left, linked and come back to.
 *
 * One question a step. Only the first is worth insisting on, and even that never blocks: "Skip for now" is on every step, Esc does the same, and
 * what was typed is kept either way. No glass here: the ambient frame is the background and every surface is solid. Rendering writes nothing; each
 * step saves its answer, the last one writes the preferences, and the review saves the section as edited.
 */
export function WelcomePage() {
  const snapshot = useProfile((s) => s.snapshot);
  return (
    <div data-cc className="cc-scroll relative min-h-0 flex-1 overflow-y-auto">
      {snapshot ? (
        <Welcome initial={snapshot.interview.answers} />
      ) : (
        <Frame onSkip={() => useShell.getState().go(HOME)}>
          <ProfileSkeleton label={C().welcome.loading} panels={1} />
        </Frame>
      )}
    </div>
  );
}

/** The page around each phase: the brand and "Skip for now" above, the footer below, the content centred between them at a reading width. */
function Frame({ onSkip, skipDisabled = false, skipping = false, onKeyDown, children }: {
  onSkip(): void;
  skipDisabled?: boolean;
  skipping?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto box-border flex min-h-full w-full max-w-2xl flex-col px-4 py-6 sm:px-8" onKeyDown={onKeyDown}>
      <header className="flex items-center gap-2.5">
        <CucCutTile className="size-6" />
        <span className="text-sm font-medium tracking-tight text-foreground">{C().welcome.brand}</span>
        <Button type="button" variant="ghost" size="sm" className="ms-auto" disabled={skipDisabled} onClick={onSkip}>
          {skipping ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
          {C().welcome.skip}
        </Button>
      </header>
      <div className="flex flex-1 flex-col justify-center gap-8 py-10">{children}</div>
      <footer className="text-xs leading-relaxed text-muted-foreground">{C().welcome.footer}</footer>
    </div>
  );
}

function Welcome({ initial }: { initial: InterviewAnswers }) {
  const runtime = useRuntime();
  const id = useId();
  const lock = useProfileLock();
  const agent = useConnection((s) => hasWriterAgent(s.drivers));
  const lines = useProfile((s) => s.writing?.lines ?? null);
  const [answers, setAnswers] = useState<InterviewAnswers>(() => ({ ...initial }));
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [result, setResult] = useState<ProfileWriteResult | null>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const current = welcomeStep(answers, step);
  const copy = C().question[current.question];
  const value = answers[current.question] ?? '';

  useEffect(() => {
    if (phase === 'asking') field.current?.focus();
    else if (phase === 'review') reviewTitle.current?.focus();
  }, [phase, step]);

  const fail = (message: string) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  /** Saves what differs from the stored answers (nothing when unchanged), so leaving at any step loses nothing. */
  const remember = async (): Promise<boolean> => {
    const saved = useProfile.getState().snapshot?.interview.answers ?? {};
    const changed = changedAnswers(answers, saved);
    if (!Object.keys(changed).length) return true;
    try {
      await saveAnswers(runtime, changed);
      return true;
    } catch (err) {
      fail(C().welcome.saveFailed(errorText(err)));
      return false;
    }
  };

  const goHome = () => useShell.getState().go(HOME);

  const skip = async () => {
    if (pending || phase === 'writing') return;
    // In the browser nothing here can be saved: leaving is all "Skip" can do.
    if (lock) return goHome();
    setPending('skip');
    setError(null);
    try {
      // Save before skipping, not alongside it: what was typed is kept for the day they come back, and the skip is the last word on the state.
      if (!(await remember())) return;
      // A finished interview stays finished; leaving the review (or a redo's first step) is not a skip.
      if (useProfile.getState().snapshot?.interview.status !== 'done') await skipInterview(runtime);
      goHome();
    } catch (err) {
      fail(C().welcome.skipFailed(errorText(err)));
    } finally {
      setPending(null);
    }
  };

  const write = async () => {
    setPhase('writing');
    setError(null);
    try {
      const written = await writeFromAnswers(runtime);
      setResult(written);
      setText(written.preferences);
      setPhase('review');
    } catch (err) {
      setPhase('asking');
      fail(C().welcome.writeFailed(errorText(err)));
    }
  };

  const advance = async () => {
    if (current.blocked || pending || lock) return;
    setPending('save');
    setError(null);
    const ok = await remember();
    setPending(null);
    if (!ok) return;
    if (current.last) void write();
    else setStep(current.index + 1);
  };

  const finish = async () => {
    if (pending || lock || !result) return;
    setPending('finish');
    setError(null);
    try {
      if (text.trim() !== result.preferences.trim()) await setPreferences(runtime, { interview: text });
      goHome();
    } catch (err) {
      fail(C().welcome.finishFailed(errorText(err)));
    } finally {
      setPending(null);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented || phase !== 'asking' || pending) return;
    event.preventDefault();
    void skip();
  };

  const fieldId = `${id}-${current.question}`;
  const hintId = `${id}-hint`;
  // Why "Continue" is off, or what Enter does: one hint, the most pressing first.
  const hint = lock
    ? null
    : current.blocked
      ? C().welcome.needWho
      : current.last && agent === false
        ? C().answers.noAgent
        : current.last
          ? null
          : C().welcome.enterHint;

  return (
    <Frame onSkip={() => void skip()} skipDisabled={!!pending || phase === 'writing'} skipping={pending === 'skip'} onKeyDown={onKeyDown}>
      {phase === 'asking' ? (
        <>
          <Steps count={current.total} step={current.index} />
          <div className="flex flex-col gap-2">
            <p className="m-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">{C().welcome.step(current.index + 1, current.total)}</p>
            <label htmlFor={fieldId} className="text-2xl font-semibold tracking-[-0.02em] text-balance text-foreground">
              {copy.label}
            </label>
            <p className="m-0 text-sm text-muted-foreground">{current.required ? C().welcome.required : C().welcome.optional}</p>
            <LockNote>{lock}</LockNote>
          </div>
          <Textarea
            ref={field}
            id={fieldId}
            rows={3}
            value={value}
            placeholder={copy.placeholder}
            disabled={!!lock}
            aria-describedby={hint ? hintId : undefined}
            onChange={(event) => setAnswers({ ...answers, [current.question]: event.target.value })}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              void advance();
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="lg" disabled={current.blocked || !!pending || !!lock} onClick={() => void advance()}>
              {pending === 'save' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : current.last ? <Sparkles aria-hidden /> : null}
              {current.last ? C().welcome.write : C().welcome.continue}
              {current.last ? null : <ArrowRight aria-hidden data-icon="inline-end" />}
            </Button>
            {current.index > 0 ? (
              <Button type="button" variant="ghost" size="lg" disabled={!!pending} onClick={() => setStep(current.index - 1)}>
                <ArrowLeft aria-hidden />
                {C().welcome.back}
              </Button>
            ) : null}
            {hint ? (
              <span id={hintId} className="text-xs text-muted-foreground">
                {hint}
              </span>
            ) : null}
          </div>
          <ErrorLine ref={errorRef}>{error}</ErrorLine>
        </>
      ) : phase === 'writing' ? (
        <div className="flex flex-col gap-3" aria-busy>
          <h1 className="m-0 flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
            <Loader2 aria-hidden className="size-5 motion-safe:animate-spin" />
            {C().welcome.writingTitle}
          </h1>
          <p className="m-0 text-sm text-muted-foreground">{C().welcome.writingBody}</p>
          <ol aria-live="polite" className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-xs text-muted-foreground">
            {(lines ?? []).slice(-3).map((line, i) => (
              <li key={i} className="truncate">
                {line}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Review
          result={result!}
          text={text}
          titleRef={reviewTitle}
          pending={pending}
          lock={lock}
          onText={setText}
          onSave={() => void finish()}
          onChange={() => {
            setError(null);
            setStep(0);
            setPhase('asking');
          }}>
          <ErrorLine ref={errorRef}>{error}</ErrorLine>
        </Review>
      )}
    </Frame>
  );
}

/** The section as written, editable before it is kept: only the interview's own lines, never the user's (which live in their own field). */
function Review({ result, text, titleRef, pending, lock, onText, onSave, onChange, children }: {
  result: ProfileWriteResult;
  text: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  pending: Pending;
  lock: string | null;
  onText(text: string): void;
  onSave(): void;
  onChange(): void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 ref={titleRef} tabIndex={-1} className="m-0 flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em] text-foreground outline-none">
          <Check aria-hidden className="size-5 text-primary" />
          {result.fallbackReason ? C().welcome.reviewTitleTyped : C().welcome.reviewTitle}
        </h1>
        <p className="m-0 text-sm text-muted-foreground">{C().welcome.reviewBody}</p>
      </div>
      {result.fallbackReason ? (
        <p role="status" className="m-0 rounded-2xl px-4 py-3 text-sm text-foreground ring-1 ring-foreground/15">
          {C().fallback[result.fallbackReason]} {C().welcome.keptAsTyped}
        </p>
      ) : null}
      <Textarea
        id={`${id}-section`}
        rows={12}
        aria-label={C().welcome.reviewLabel}
        className="font-mono text-xs leading-relaxed md:text-xs"
        value={text}
        disabled={!!lock}
        onChange={(event) => onText(event.target.value)}
      />
      {result.names.length ? <p className="m-0 text-xs text-muted-foreground">{C().welcome.namesAdded(result.names.join(', '))}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="lg" disabled={!!pending || !!lock} onClick={onSave}>
          {pending === 'finish' ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Check aria-hidden />}
          {C().welcome.saveAndStart}
        </Button>
        <Button type="button" variant="ghost" size="lg" disabled={!!pending} onClick={onChange}>
          {C().welcome.changeAnswer}
        </Button>
      </div>
      {children}
    </div>
  );
}

/** Where you are, without a percentage: five marks, the ones behind you filled. */
function Steps({ count, step }: { count: number; step: number }) {
  return (
    <ol aria-label={C().welcome.steps(step + 1, count)} className="m-0 flex list-none gap-1.5 p-0">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          aria-hidden
          className={cn(
            'h-1 flex-1 rounded-full transition-colors motion-reduce:transition-none',
            i < step ? 'bg-primary/60' : i === step ? 'bg-primary' : 'bg-white/10',
          )}
        />
      ))}
    </ol>
  );
}
