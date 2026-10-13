import { useEffect, type ReactNode } from 'react';
import type { PackDiagnostic, PackSummary } from '@cuccut/protocol';
import { ChevronRight, Download, FolderOpen, GitBranch, Globe, Package, TriangleAlert, Upload, type LucideIcon } from 'lucide-react';
import { RouteLink, SectionHeader } from '../../../cc/components/page-chrome.tsx';
import { Button, buttonVariants } from '../../../cc/ui/button.tsx';
import { Skeleton } from '../../../cc/ui/skeleton.tsx';
import { shortenPath } from '../../../model/format.ts';
import { packContents, packNoticeText, packOrigin, packVersionLine, type PackOrigin } from '../../../model/packs.ts';
import { useRuntime } from '../../../runtime/context.tsx';
import { loadPacks } from '../../../runtime/pack-commands.ts';
import { useConnection } from '../../../state/connection-store.ts';
import { usePacks } from '../../../state/packs-store.ts';
import type { Route } from '../../../state/shell-store.ts';
import { PACKS_COPY } from '../packs-copy.ts';
import { PANEL, PANEL_HOVER } from '../settings-ui.tsx';

const L = () => PACKS_COPY.list;

const ORIGIN_ICON: Record<PackOrigin['kind'], LucideIcon> = { local: FolderOpen, github: GitBranch, url: Globe };

const packsRoute = (sub?: string): Route => (sub ? { tab: 'settings', section: 'packs', sub } : { tab: 'settings', section: 'packs' });

/**
 * Settings › Packs (pack design §2.2, agentcut `PacksSettings`): what is installed and where each came from. Each row
 * opens the pack's own page; importing and exporting are pages of their own (`/settings/packs/import`, `…/export`),
 * because what a pack carries is text an agent will follow and is read, not glanced at.
 *
 * The list is the Runtime's (`packs.list`), fetched when the page mounts and on reconnect. Import and export write to
 * the Runtime Home, so they are offered only in the desktop app; a browser shows the list and says where they are.
 * The notice line says what the last flow did ("Installed X.") until the next one starts or a pack is deleted.
 */
export function PacksList({ title, blurb }: { title: string; blurb: ReactNode }) {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const connected = useConnection((s) => s.state.status === 'connected');
  const status = usePacks((s) => s.status);
  const loaded = usePacks((s) => s.loaded);
  const packs = usePacks((s) => s.packs);
  const diagnostics = usePacks((s) => s.diagnostics);
  const error = usePacks((s) => s.error);
  const notice = usePacks((s) => s.notice);

  useEffect(() => {
    if (connected) void loadPacks(runtime);
  }, [runtime, connected]);

  const actions = web ? null : <FlowLinks />;

  let body: ReactNode;
  if (!loaded) {
    body =
      !connected || status === 'failed' ? (
        <div className={`${PANEL} flex flex-col items-start gap-3 px-5 py-4`} role="status">
          <p className="m-0 text-sm text-muted-foreground">{!connected ? L().disconnected : L().loadFailed(error ?? '')}</p>
          {connected ? (
            <Button variant="outline" size="sm" onClick={() => void loadPacks(runtime)}>
              {L().retry}
            </Button>
          ) : null}
        </div>
      ) : (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">{L().loading}</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} aria-hidden className="h-[4.75rem] rounded-3xl" />
          ))}
        </div>
      );
  } else if (!packs.length) {
    body = (
      <div className={`${PANEL} flex flex-col items-start gap-3 px-5 py-5`}>
        <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-foreground/5 text-muted-foreground">
          <Package className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-sm font-medium text-foreground">{L().emptyTitle}</h3>
          <p className="m-0 max-w-prose text-sm text-muted-foreground">{L().emptyBody}</p>
        </div>
        {actions}
      </div>
    );
  } else {
    body = (
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {packs.map((pack) => (
          <PackRow key={pack.id} pack={pack} />
        ))}
      </ul>
    );
  }

  return (
    <div data-cc className="flex min-w-0 flex-col gap-5">
      <SectionHeader title={title} blurb={blurb} actions={loaded && packs.length ? actions : null} />
      {/* Always in the tree, so a screen reader is listening when the text arrives. */}
      <p role="status" className={notice ? `${PANEL} m-0 px-4 py-3 text-sm text-foreground` : 'sr-only'}>
        {notice ? packNoticeText(notice) : ''}
      </p>
      {web ? <p className="m-0 text-sm text-muted-foreground">{L().webNote}</p> : null}
      {body}
      {loaded && status === 'failed' && error ? (
        <p role="alert" className="m-0 text-sm text-destructive">
          {L().loadFailed(error)}
        </p>
      ) : null}
      {diagnostics.length ? <Diagnostics items={diagnostics} /> : null}
    </div>
  );
}

/** "Export a pack" (neutral) and "Import a pack" (the view's one tinted action). */
function FlowLinks() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RouteLink route={packsRoute('export')} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <Upload aria-hidden />
        {PACKS_COPY.export.title}
      </RouteLink>
      <RouteLink route={packsRoute('import')} className={buttonVariants({ variant: 'default', size: 'sm' })}>
        <Download aria-hidden />
        {PACKS_COPY.import.title}
      </RouteLink>
    </div>
  );
}

/** One installed pack: a link card to its page with its version, what it brought and where it came from. */
function PackRow({ pack }: { pack: PackSummary }) {
  const origin = packOrigin(pack.source);
  const Origin = ORIGIN_ICON[origin.kind];
  return (
    <li>
      <RouteLink
        route={packsRoute(pack.id)}
        className={`${PANEL_HOVER} group flex items-center gap-3 px-4 py-3.5 transition-[box-shadow,background-color] hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none`}>
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground/5 text-muted-foreground group-hover:text-primary">
          <Package className="size-5" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{pack.name}</span>
            <span className="text-xs text-muted-foreground">{packVersionLine(pack)}</span>
          </span>
          <span className="mt-0.5 text-xs text-muted-foreground">{packContents(pack)}</span>
          <span className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground/80" title={origin.full}>
            <Origin aria-label={origin.label} role="img" className="size-3 shrink-0" />
            <span className="truncate font-mono">{origin.short}</span>
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </RouteLink>
    </li>
  );
}

/** Folders under the packs folder whose record can't be read: shown so they can be dealt with, never fatal. */
function Diagnostics({ items }: { items: PackDiagnostic[] }) {
  return (
    <section aria-label={L().diagnostics} className={`${PANEL} flex flex-col gap-2 px-5 py-4`}>
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-medium text-foreground">{L().diagnostics}</h3>
          <p className="m-0 mt-0.5 max-w-prose text-sm text-muted-foreground">{L().diagnosticsHint}</p>
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col divide-y divide-foreground/8 p-0">
        {items.map((item) => (
          <li key={item.path} className="flex flex-col gap-0.5 py-2.5">
            <span className="font-mono text-xs text-foreground [overflow-wrap:anywhere] select-text">{shortenPath(item.path)}</span>
            <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{[item.message, ...item.issues].join(' · ')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
