import { useId, type ReactNode } from 'react';
import { cn } from 'cn';

/**
 * A section of the landing page below the composer (agentcut `ProjectList` heading): a small title with an optional
 * count, one line of what it holds, actions on the right, then the content. Solid content, never glass.
 */
export function LandingSection({
  title,
  count,
  blurb,
  actions,
  children,
  className,
  label,
}: {
  title: ReactNode;
  count?: number;
  blurb?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** An accessible name for the section when the visible title is not enough. */
  label?: string;
}) {
  const id = useId();
  return (
    <section data-cc aria-labelledby={label ? undefined : id} aria-label={label} className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-foreground">
            {title}
            {count != null ? (
              <>
                {/* Read as "Recent, 7" rather than "Recent7". */}
                <span className="sr-only">, </span>
                <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
              </>
            ) : null}
          </h2>
          {blurb ? <p className="mt-1 text-sm text-muted-foreground">{blurb}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
