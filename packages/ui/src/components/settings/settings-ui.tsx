import type { ReactNode } from 'react';
import { cn } from 'cn';

/*
 * The building blocks of every settings page, after agentcut's workspace shell (`modules/settings/components/
 * section-header.tsx`): a solid panel in the content layer (24px corners, a hairline ring, never glass), a small heading
 * inside it (icon, name, one line of why, an action), and the rows CucCut's settings are made of (name and
 * description on the left, the control on the right, a hairline between rows).
 *
 * These are Tailwind-styled but not marked `data-cc`: the rows hold Spectrum controls, which the scoped preflight
 * must not reach. Margins on headings and paragraphs are therefore reset by hand.
 */

/** The panel surface; exported for the few lists that draw their own container (provider list, skill cards). */
export const PANEL = 'rounded-3xl bg-card ring-1 ring-foreground/10';
/** The panel surface for a card that is itself clickable: the ring brightens on hover. */
export const PANEL_HOVER = `${PANEL} transition-shadow hover:ring-foreground/20`;
/** A smaller solid tile nested in a panel or listed on its own (inner radius follows the 24px parent minus padding). */
export const TILE = 'rounded-2xl bg-card ring-1 ring-foreground/10';

/** A solid surface that groups controls. `flush` drops the inset for lists that run edge to edge. */
export function Panel({
  label,
  flush = false,
  className,
  children,
}: {
  label?: string;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className={cn(PANEL, 'min-w-0', flush ? 'overflow-hidden' : 'px-5 py-4', className)}>
      {children}
    </section>
  );
}

/**
 * A panel that is only a list of rows: the rows run under each other with a hairline between them. `flush` drops the
 * inset and clips to the corners, for lists whose rows draw their own full-width bands (agent providers).
 */
export function RowPanel({ label, flush = false, children }: { label?: string; flush?: boolean; children: ReactNode }) {
  return (
    <Panel label={label} flush={flush} className={flush ? undefined : 'py-1.5'}>
      {flush ? children : <RowList>{children}</RowList>}
    </Panel>
  );
}

/** The small heading inside a panel: what this group is, and one line of why. */
export function PanelHeading({
  title,
  hint,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start gap-x-3 gap-y-2', className)}>
      {icon ? (
        <span aria-hidden className="mt-0.5 flex shrink-0 text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 basis-60">
        <h3 className="m-0 text-sm font-medium text-foreground">{title}</h3>
        {hint ? <p className="m-0 mt-0.5 max-w-prose text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** A panel of setting rows under one heading (the shape of most settings sections). */
export function SettingsGroup({
  title,
  hint,
  icon,
  action,
  note,
  children,
}: {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  /** A line under the heading saying why the controls below are read-only here. */
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel label={title} className="flex flex-col gap-2 pb-1.5">
      <PanelHeading title={title} hint={hint} icon={icon} action={action} />
      {note ? <p className="m-0 text-xs text-foreground/80">{note}</p> : null}
      <RowList>{children}</RowList>
    </Panel>
  );
}

/** Rows with a hairline between them. */
export function RowList({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex min-w-0 flex-col divide-y divide-foreground/8', className)}>{children}</div>;
}

/**
 * One setting: the name, its description and (when the control is off) why, on the left; the control on the right.
 * On narrow columns the control drops under the text rather than squeezing it. `below` holds full-width content
 * (a command, a path, a checklist) under both.
 */
export function SettingsRow({
  label,
  desc,
  note,
  muted = false,
  children,
  below,
}: {
  label: ReactNode;
  desc?: ReactNode;
  note?: ReactNode;
  muted?: boolean;
  children?: ReactNode;
  below?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
      <div className="min-w-0 flex-1 basis-56">
        <div className={cn('text-sm font-medium', muted ? 'text-muted-foreground' : 'text-foreground')}>{label}</div>
        {desc ? <div className="mt-0.5 text-xs leading-relaxed [overflow-wrap:anywhere] text-muted-foreground select-text">{desc}</div> : null}
        {note ? <div className="mt-1 text-xs leading-relaxed [overflow-wrap:anywhere] text-foreground/80">{note}</div> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
      {below ? <div className="min-w-0 basis-full">{below}</div> : null}
    </div>
  );
}

/** A sub-heading between panels on a long page (agentcut "On this machine"). */
export function SubHeading({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 pt-2">
      <div className="min-w-0 flex-1 basis-60">
        <h3 className="m-0 text-base font-medium tracking-[-0.01em] text-foreground">{title}</h3>
        {hint ? <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

const KEYCAP =
  'inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-white/8 px-1.5 font-sans text-xs font-medium text-foreground shadow-(--control-highlight) ring-1 ring-white/10';

/** One key combination as keycaps: `⇧⌘H` → ⇧ ⌘ H, `Ctrl+Shift+H` → Ctrl Shift H. */
function Combo({ combo }: { combo: string }) {
  const parts = combo.includes('+') && combo !== '+' ? combo.split('+') : (combo.match(/[⌃⌥⇧⌘]|[^⌃⌥⇧⌘]+/g) ?? [combo]);
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((part, i) => (
        <kbd key={i} className={KEYCAP}>
          {part}
        </kbd>
      ))}
    </span>
  );
}

/**
 * A shortcut as keycaps, shared by Settings › Shortcuts and the help center. Alternatives written `A / B` get a quiet
 * slash between them; a description rather than keys (anything with a space in it) stays text; `—` (no shortcut on
 * this platform) keeps the keycap row height.
 */
export function KeyCombo({ keys }: { keys: string }) {
  if (keys === '—') return <span className="inline-flex h-6 items-center text-sm text-muted-foreground">—</span>;
  const alternatives = keys.split(' / ');
  if (alternatives.some((alt) => alt.includes(' '))) {
    return <span className="text-end text-xs text-muted-foreground">{keys}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
      {alternatives.map((alt, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden className="text-xs text-muted-foreground">/</span> : null}
          <Combo combo={alt} />
        </span>
      ))}
    </span>
  );
}
