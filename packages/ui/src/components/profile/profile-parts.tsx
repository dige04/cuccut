import { forwardRef, type ReactNode } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { cn } from 'cn';
import { Skeleton } from '../../cc/ui/skeleton.tsx';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useProfile } from '../../state/profile-store.ts';
import { PANEL } from '../settings/settings-ui.tsx';
import { PROFILE_COPY } from './profile-copy.ts';

/*
 * Pieces the profile screens share (Settings › You, Settings › Rules, the rule form): why a control is off, an error line, an empty card, the
 * loading skeleton, a recessed native select and the Undo toast. They sit under a `data-cc` root.
 */

/**
 * Why the profile can't be changed here, or null when it can: a browser session (writes are desktop only), a profile file from a newer CucCut
 * (`readOnly`), or no Runtime connection.
 */
export function useProfileLock(): string | null {
  const web = useRuntime().host.platform === 'web';
  const readOnly = useProfile((s) => s.snapshot?.readOnly ?? false);
  const connected = useConnection((s) => s.state.status === 'connected');
  if (web) return PROFILE_COPY.common.desktopOnly;
  if (readOnly) return PROFILE_COPY.common.readOnly;
  if (!connected) return PROFILE_COPY.common.disconnected;
  return null;
}

/** A failure under the panel it belongs to; focusable so a failed save can move focus to it. Renders nothing without a message. */
export const ErrorLine = forwardRef<HTMLParagraphElement, { children: ReactNode; className?: string }>(function ErrorLine({ children, className }, ref) {
  if (!children) return null;
  return (
    <p
      ref={ref}
      role="alert"
      tabIndex={-1}
      className={cn('m-0 rounded-xl px-3 py-2 text-sm whitespace-pre-wrap text-destructive ring-1 ring-destructive/40 outline-none', className)}>
      {children}
    </p>
  );
});

/** A quiet line saying why the controls nearby are off. */
export function LockNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="m-0 text-xs text-foreground/80">{children}</p>;
}

/** A place with nothing in it (agentcut `Empty`): what it is, and the one way forward. */
export function EmptyCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={cn(PANEL, 'flex flex-col items-start gap-2 px-5 py-8')}>
      <p className="m-0 text-sm font-medium text-foreground">{title}</p>
      <p className="m-0 max-w-prose text-sm text-muted-foreground">{children}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Rows of skeleton while the first `profile` snapshot is on its way. */
export function ProfileSkeleton({ label, panels = 2 }: { label: string; panels?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-5">
      {Array.from({ length: panels }, (_, i) => (
        <div key={i} className={cn(PANEL, 'flex flex-col gap-3 px-5 py-4')}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/** The recessed field look of `Input`, for a native `<select>` (the platform list is keyboard- and screen-reader-complete). */
export const SELECT_FIELD =
  'h-9 w-full min-w-0 rounded-xl border border-border bg-black/15 px-2 text-base text-foreground shadow-(--field-shadow) transition-[border-color,box-shadow] duration-150 outline-none hover:border-white/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:text-sm [&>option]:bg-popover [&>option]:text-popover-foreground';

/** A change that already happened, with Undo (CLAUDE.md rule 1: destructive actions act and offer Undo). A failed undo says so. */
export function undoToast(text: string, undo: () => Promise<unknown>): void {
  ToastQueue.neutral(text, {
    actionLabel: PROFILE_COPY.common.undo,
    shouldCloseOnAction: true,
    onAction: () => {
      undo().catch((error: Error) => ToastQueue.negative(PROFILE_COPY.common.undoFailed(error.message), { timeout: 6000 }));
    },
  });
}

/** The message of a failed command. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
