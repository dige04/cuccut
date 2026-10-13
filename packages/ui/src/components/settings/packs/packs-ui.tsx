import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from 'cn';
import { RouteLink, SectionHeader } from '../../../cc/components/page-chrome.tsx';
import { buttonVariants } from '../../../cc/ui/button.tsx';
import type { Route } from '../../../state/shell-store.ts';
import { PACKS_COPY } from '../packs-copy.ts';

/*
 * Pieces the pages under Settings › Packs share (pack design §2): the route of a page, the "← Packs" link above
 * each page inside the section, and the red recessed box that shows text an agent will follow, in full.
 */

/** `/settings/packs` or a page inside it (`import`, `export`, a pack id). */
export const packsRoute = (sub?: string): Route => (sub ? { tab: 'settings', section: 'packs', sub } : { tab: 'settings', section: 'packs' });

/** The heading of a page inside the section: "← Packs" above the title, its blurb and actions. */
export function PacksPageHeader({ title, blurb, actions }: { title: ReactNode; blurb?: ReactNode; actions?: ReactNode }) {
  return (
    <div data-cc className="flex flex-col gap-2">
      <RouteLink route={packsRoute()} className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), '-ms-2 self-start text-muted-foreground')}>
        <ArrowLeft aria-hidden />
        {PACKS_COPY.back}
      </RouteLink>
      <SectionHeader title={title} blurb={blurb} actions={actions} />
    </div>
  );
}

/**
 * Text an agent will follow (a template prompt, a `SKILL.md`, a style guide, a quick action): shown in full in a
 * red-tinted recessed box, never summarised. It scrolls on its own when long and can be reached with the keyboard.
 */
export function AgentText({ label, children, className }: { label: string; children: string; className?: string }) {
  return (
    <pre
      tabIndex={0}
      role="region"
      aria-label={label}
      className={cn(
        'm-0 max-h-72 overflow-auto rounded-xl bg-destructive/8 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground ring-1 ring-destructive/20 [overflow-wrap:anywhere] select-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}>
      {children}
    </pre>
  );
}

/** A failure line under a form or a panel. */
export function ErrorLine({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 text-sm text-destructive">
      {children}
    </p>
  );
}
