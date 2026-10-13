import { useEffect, useState, type ReactNode } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import type { PackDetail, PackItemView } from '@cuccut/protocol';
import { BookA, FolderOpen, GitBranch, Globe, LayoutTemplate, Library, LoaderCircle, MessageSquareText, Package, Scale, Sparkles, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { RouteLink } from '../../../cc/components/page-chrome.tsx';
import { Button, buttonVariants } from '../../../cc/ui/button.tsx';
import { Skeleton } from '../../../cc/ui/skeleton.tsx';
import { packDeletedText, packErrorCode, packErrorMessage, packItemStateLabel, packOrigin, packOriginLine, type PackOrigin } from '../../../model/packs.ts';
import { useRuntime } from '../../../runtime/context.tsx';
import { getPack, removePack, restorePack } from '../../../runtime/pack-commands.ts';
import { loadSkills } from '../../../runtime/skill-commands.ts';
import { loadTemplates } from '../../../runtime/template-commands.ts';
import { useConnection } from '../../../state/connection-store.ts';
import { useShell, type Route } from '../../../state/shell-store.ts';
import { useSkills } from '../../../state/skills-store.ts';
import { useTemplateCatalog } from '../../../state/template-catalog-store.ts';
import { PACKS_COPY } from '../packs-copy.ts';
import { PANEL, Panel, PanelHeading } from '../settings-ui.tsx';
import { AgentText, ErrorLine, PacksPageHeader, packsRoute } from './packs-ui.tsx';
import { StyleEditor } from './style-editor.tsx';

const P = () => PACKS_COPY.pack;

const ORIGIN_ICON: Record<PackOrigin['kind'], LucideIcon> = { local: FolderOpen, github: GitBranch, url: Globe };

type Load = { id: string; state: 'loading' } | { id: string; state: 'ready'; detail: PackDetail } | { id: string; state: 'missing' } | { id: string; state: 'failed'; message: string };

/**
 * One installed pack (pack design §2.5, agentcut `PackView`): where it came from, what it brought and how each item is
 * now, its quick actions, its style guide with the reference videos, and the reserved rules and review standard when it
 * carries them. The page is the Runtime's `packs.get`, fetched when it opens and after each change made here.
 *
 * "Delete pack" acts at once, as every destructive action does: the pack and its unchanged templates and skills go to
 * the trash, the page returns to the list, and the toast offers Undo (`packs.restore`) for as long as it shows. In a
 * browser the page is read-only and says where it can be changed.
 */
export function PackPage({ id }: { id: string }) {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const connected = useConnection((s) => s.state.status === 'connected');
  const go = useShell((s) => s.go);
  const [load, setLoad] = useState<Load>({ id, state: 'loading' });
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current: Load = load.id === id ? load : { id, state: 'loading' };

  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    getPack(runtime, id).then(
      (detail) => !cancelled && setLoad({ id, state: 'ready', detail }),
      (reason: unknown) =>
        !cancelled &&
        setLoad(packErrorCode(reason) === 'PACK_NOT_FOUND' ? { id, state: 'missing' } : { id, state: 'failed', message: packErrorMessage(reason, 'read') }),
    );
    // Template titles and skill names for the item capsules.
    void loadTemplates(runtime);
    void loadSkills(runtime);
    return () => {
      cancelled = true;
    };
  }, [runtime, id, connected]);

  if (current.state === 'missing') {
    return (
      <div data-cc className="flex min-w-0 flex-col gap-5">
        <PacksPageHeader title={P().notFoundTitle} />
        <div className={`${PANEL} flex flex-col items-start gap-3 px-5 py-5`}>
          <p className="m-0 max-w-prose text-sm text-muted-foreground">{PACKS_COPY.errors.notFound(id)}</p>
          <RouteLink route={packsRoute()} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {P().backToPacks}
          </RouteLink>
        </div>
      </div>
    );
  }
  if (current.state !== 'ready') {
    return (
      <div data-cc className="flex min-w-0 flex-col gap-5">
        <PacksPageHeader title={id} />
        {current.state === 'failed' || !connected ? (
          <p role="alert" className="m-0 text-sm text-destructive">
            {current.state === 'failed' ? current.message : PACKS_COPY.list.disconnected}
          </p>
        ) : (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">{P().loading}</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} aria-hidden className="h-24 rounded-3xl" />
            ))}
          </div>
        )}
      </div>
    );
  }

  const { detail } = current;
  const { pack } = detail;

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      const result = await removePack(runtime, pack.id);
      go(packsRoute());
      ToastQueue.neutral(packDeletedText(result), {
        timeout: 8000,
        actionLabel: P().undo,
        shouldCloseOnAction: true,
        onAction: () => {
          restorePack(runtime, result.trashId).then(
            (restored) => ToastQueue.positive(P().restored(restored.pack.name), { timeout: 4000 }),
            (reason: unknown) => ToastQueue.negative(packErrorMessage(reason, 'restore'), { timeout: 8000 }),
          );
        },
      });
    } catch (reason) {
      setError(packErrorMessage(reason, 'remove'));
      setDeleting(false);
    }
  };

  const actions = web ? null : (
    <Button variant="outline" size="sm" disabled={deleting} onClick={() => void remove()}>
      {deleting ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Trash2 aria-hidden />}
      {deleting ? P().deleting : P().delete}
    </Button>
  );

  return (
    <div data-cc className="flex min-w-0 flex-col gap-5">
      <PacksPageHeader title={pack.name} blurb={pack.description || P().noDescription} actions={actions} />
      <ErrorLine>{error}</ErrorLine>
      {web ? <p className="m-0 text-sm text-muted-foreground">{PACKS_COPY.webOnly}</p> : null}
      <Origin detail={detail} web={web} />
      <Brought detail={detail} />
      {detail.quickActions.length ? (
        <Panel className="flex flex-col gap-3">
          <PanelHeading icon={<MessageSquareText />} title={P().quick} hint={P().quickHint} />
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {detail.quickActions.map((action, i) => (
              <li key={i} className="rounded-2xl bg-foreground/[0.04] px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{action.label}</span>
                <span className="text-muted-foreground"> — {action.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel>
        <StyleEditor detail={detail} web={web} onSaved={(next) => setLoad({ id, state: 'ready', detail: next })} />
      </Panel>
      {detail.reserved.rules.length || detail.reserved.review ? (
        <Panel className="flex flex-col gap-3">
          <PanelHeading icon={<Scale />} title={P().reserved} hint={P().reservedHint} />
          {detail.reserved.rules.map((rule) => (
            <div key={rule.path} className="flex flex-col gap-1">
              <span className="font-mono text-xs text-muted-foreground">{rule.path}</span>
              <AgentText label={rule.path}>{rule.text}</AgentText>
            </div>
          ))}
          {detail.reserved.review ? <AgentText label={P().reserved}>{detail.reserved.review}</AgentText> : null}
        </Panel>
      ) : null}
    </div>
  );
}

/** Version, author, install date, and the full source (a folder can be shown in Finder / Explorer). */
function Origin({ detail, web }: { detail: PackDetail; web: boolean }) {
  const runtime = useRuntime();
  const { pack } = detail;
  const origin = packOrigin(pack.source);
  const Icon = ORIGIN_ICON[origin.kind];
  const local = pack.source.kind === 'local' ? pack.source.path : null;
  return (
    <Panel className="flex flex-col gap-3">
      <PanelHeading
        icon={<Package />}
        title={P().origin}
        hint={packOriginLine(pack)}
        action={
          local && !web ? (
            <Button variant="outline" size="sm" onClick={() => void runtime.host.revealPath(local)}>
              <FolderOpen aria-hidden />
              {P().reveal}
            </Button>
          ) : null
        }
      />
      <p className="m-0 flex items-start gap-1.5 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere] select-text">
        <Icon role="img" aria-label={origin.label} className="mt-0.5 size-3.5 shrink-0" />
        {origin.full}
      </p>
    </Panel>
  );
}

interface ItemGroup {
  key: 'templates' | 'skills' | 'library';
  label: string;
  Icon: LucideIcon;
  items: { item: PackItemView; name: string; route: Route | null }[];
}

/**
 * What the pack brought and how each item is now: capsules that open where the item lives (a template's details in
 * Home's "All templates", a skill's details in Settings › Skills, glossaries in Settings › Glossary). An item changed since install says so; one deleted since is
 * struck through.
 */
function Brought({ detail }: { detail: PackDetail }) {
  const templates = useTemplateCatalog((s) => s.templates);
  const skills = useSkills((s) => s.skills);
  const groups: ItemGroup[] = [
    {
      key: 'templates' as const,
      label: P().templates,
      Icon: LayoutTemplate,
      items: detail.items.templates.map((item) => ({
        item,
        name: item.name ?? templates.find((t) => t.id === item.id)?.title ?? item.id,
        route: { tab: 'home', conversationId: null, projectId: null, template: item.id } satisfies Route,
      })),
    },
    {
      key: 'skills' as const,
      label: P().skills,
      Icon: Sparkles,
      items: detail.items.skills.map((item) => ({
        item,
        name: item.name ?? skills.find((s) => s.id === item.id)?.name ?? item.id,
        route: { tab: 'settings', section: 'skills', sub: item.id } satisfies Route,
      })),
    },
    {
      key: 'library' as const,
      label: P().library,
      Icon: Library,
      items: detail.items.library.map((item) => ({
        item,
        name: item.name ?? item.id,
        // Glossaries have a page of their own; brand items live in the editor's brand panel.
        route: item.library === 'glossaries' ? ({ tab: 'settings', section: 'glossary' } satisfies Route) : null,
      })),
    },
  ].filter((group) => group.items.length);

  return (
    <Panel className="flex flex-col gap-4">
      <PanelHeading icon={<BookA />} title={P().brought} hint={P().broughtHint} />
      {groups.length ? (
        <div className="grid gap-4 @lg:grid-cols-2">
          {groups.map(({ key, label, Icon, items }) => (
            <div key={key} className="flex min-w-0 flex-col gap-1.5">
              <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon aria-hidden className="size-3.5" />
                {label} <span className="tabular-nums">{items.length}</span>
              </p>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {items.map(({ item, name, route }) => (
                  <li key={item.id}>
                    <ItemCapsule name={name} id={item.id} state={item.state} route={route} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">{P().nothing}</p>
      )}
    </Panel>
  );
}

/** One item: a capsule link to where it lives, or a plain capsule when it has no page of its own. */
function ItemCapsule({ name, id, state, route }: { name: string; id: string; state: PackItemView['state']; route: Route | null }) {
  const note = packItemStateLabel(state);
  const body: ReactNode = (
    <>
      <span className={cn(state === 'deleted' && 'line-through')}>{name}</span>
      {note ? <span className="text-muted-foreground"> {note}</span> : null}
    </>
  );
  // Capsules are for things you can click; an item with no page of its own is plain text.
  if (!route) {
    return (
      <span title={id} className="inline-block px-1 py-1 text-xs text-foreground [overflow-wrap:anywhere]">
        {body}
      </span>
    );
  }
  return (
    <RouteLink
      route={route}
      className={cn(
        'inline-block rounded-full px-2.5 py-1 text-xs ring-1 transition-colors [overflow-wrap:anywhere] hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
        state === 'deleted' ? 'text-muted-foreground ring-foreground/5' : 'bg-foreground/5 text-foreground ring-foreground/10',
      )}>
      <span title={id}>{body}</span>
    </RouteLink>
  );
}
