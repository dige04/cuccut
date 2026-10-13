import { ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { RouteLink } from '../../cc/components/page-chrome.tsx';
import { resultLine, TOOL_GROUPS, type ToolInfo } from '../../model/tool-catalog.ts';
import { plannedReason, toolBlock, toolCardStatus, type ToolCardStatus } from '../../model/tools-gallery.ts';
import { useModels } from '../../state/models-store.ts';
import { UtilityShell } from '../utility-sidebar.tsx';
import { TOOL_RAIL_ICON } from './tool-icon.tsx';
import { GALLERY_COPY, TOOLS_HOME_COPY } from './tools-copy.ts';
import { useToolStatus } from './use-tool-status.ts';

/*
 * The tools gallery (agentcut library gallery): one solid card per tool, grouped with a line on what each group is for.
 * A card says what the tool does, what it leaves behind, and whether it can run right now.
 */

const CARD =
  'group/tool relative flex h-full min-w-0 items-start gap-4 rounded-3xl bg-card p-5 text-start ring-1 ring-foreground/10 transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none';

function CardBody({ tool, state, planned }: { tool: ToolInfo; state: ToolCardStatus | null; planned: boolean }) {
  const Icon = TOOL_RAIL_ICON[tool.icon];
  return (
    <>
      <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/6 text-foreground/85', planned && 'opacity-60')}>
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          {tool.name}
          {planned ? <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs font-medium text-muted-foreground">{GALLERY_COPY.planned}</span> : null}
        </span>
        <span className={cn('text-sm leading-relaxed text-muted-foreground', planned && 'opacity-70')}>{tool.desc}</span>
        <span className="text-xs text-foreground/75">{resultLine(tool.id)}</span>
        {state ? (
          <span className="mt-1 flex items-start gap-1.5 text-xs leading-4 text-muted-foreground">
            <span aria-hidden className={cn('mt-[5px] size-1.5 shrink-0 rounded-full', state.on ? 'bg-emerald-400' : 'bg-muted-foreground/50')} />
            {state.text}
          </span>
        ) : null}
      </span>
      {planned ? null : (
        <ChevronRight
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover/tool:translate-x-0.5 motion-reduce:transition-none"
        />
      )}
    </>
  );
}

/** One tool card: a link to the tool's page when it works; greyed and inert (its status line says why) when it doesn't yet. */
function ToolCard({ tool, state }: { tool: ToolInfo; state: ToolCardStatus | null }) {
  const planned = plannedReason(tool.id) !== null;
  if (planned) {
    return (
      <li className="min-w-0">
        <div className={cn(CARD, 'bg-card/60')} role="group" aria-label={tool.name} aria-disabled="true">
          <CardBody tool={tool} state={state} planned />
        </div>
      </li>
    );
  }
  return (
    <li className="min-w-0">
      <RouteLink
        route={{ tab: 'tools', tool: tool.id }}
        label={GALLERY_COPY.open(tool.name)}
        className={cn(
          CARD,
          'hover:bg-secondary hover:ring-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
        )}>
        <CardBody tool={tool} state={state} planned={false} />
      </RouteLink>
    </li>
  );
}

/**
 * Tools overview: the tool groups, each with its line of explanation; a card per tool with what it can do, a line on
 * the result and its current status. Whether a tool can run comes from `tools.list` (its reason is shown when it
 * can't); when it can, the capability view says how many providers are connected.
 */
export function ToolsGallery() {
  const view = useModels((s) => s.capabilities);
  const status = useToolStatus();
  const cardStatus = (id: ToolInfo['id']) => toolCardStatus(id, view, status.ready ? toolBlock(status.byId.get(id), status.pipelines) : undefined);
  return (
    <UtilityShell kind="tools" title={GALLERY_COPY.title} blurb={TOOLS_HOME_COPY.lede}>
      {status.error ? (
        <p data-cc role="status" className="px-1 text-xs text-orange-300">
          {TOOLS_HOME_COPY.statusFailed(status.error)}
        </p>
      ) : null}
      {TOOL_GROUPS.map((g) => (
        <section key={g.key} data-cc className="flex flex-col gap-3" aria-labelledby={`tools-group-${g.key}`}>
          <div className="flex flex-col gap-0.5 px-1">
            <h3 id={`tools-group-${g.key}`} className="text-sm font-medium text-foreground">
              {g.label}
            </h3>
            <p className="max-w-prose text-sm text-muted-foreground">{g.desc}</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {g.tools.map((t) => (
              <ToolCard key={t.id} tool={t} state={cardStatus(t.id)} />
            ))}
          </ul>
        </section>
      ))}
      <p data-cc className="px-1 text-xs text-muted-foreground">
        {TOOLS_HOME_COPY.foot}
      </p>
    </UtilityShell>
  );
}
