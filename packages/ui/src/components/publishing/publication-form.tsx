'use client';

import { useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { Link2 } from 'lucide-react';
import type { Id, PublicationDetail, PublicationIssue, PublishingAccount, PublishingConnection, PublishingSettings } from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../cc/ui/tabs';
import {
  EMPTY_FORM,
  formReducer,
  formTabs,
  isDirty,
  publicationLocked,
  toUpdateParams,
  type FormAction,
  type FormState,
  type PublicationDraft,
} from '../../model/publication-form.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { getPublication, proposalAt, publishingError, updatePublication, usePublishingBusy } from '../../runtime/publishing-commands.ts';
import { usePublishing } from '../../state/publishing-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { NetworkIcon } from './network-icon.tsx';
import { PublicationAccounts } from './publication-accounts.tsx';
import { PublicationDelivery } from './publication-delivery.tsx';
import { PublicationDestinationFields } from './publication-destination.tsx';
import { PublicationFooter } from './publication-footer.tsx';
import { PublicationText } from './publication-text.tsx';
import { PublicationTimeCard } from './publication-time-card.tsx';
import { PublicationVideo } from './publication-video.tsx';
import { PC } from './publishing-copy.ts';
import { PublicationStatusBadge } from './status-badge.tsx';

/** A line under the form: what an action did, or why it failed (with the Runtime's validation issues), optionally with Undo. */
export interface FormNotice {
  tone: 'status' | 'error';
  text: string;
  issues?: PublicationIssue[];
  undo?: { label: string; run: () => void };
}

/**
 * Everything the publication form's sections share: the saved publication and its draft (`model/publication-form.ts`), the mirror's accounts,
 * connections and settings, and `act`, which runs one write and takes its saved result.
 */
export interface PublicationFormApi {
  id: Id;
  state: FormState;
  saved: PublicationDetail;
  draft: PublicationDraft;
  dispatch: Dispatch<FormAction>;
  dirty: boolean;
  /** A write on this publication is running. */
  busy: boolean;
  /** Publishing is read-only (`degraded`). */
  readOnly: boolean;
  /** The desktop app (the owner): authorize, send, record results. A browser session may read and edit. */
  owner: boolean;
  /** Some destination was handed over: shared text, accounts and times are frozen. */
  locked: boolean;
  accounts: PublishingAccount[];
  connections: PublishingConnection[];
  settings: PublishingSettings | null;
  notice: FormNotice | null;
  setNotice: (notice: FormNotice | null) => void;
  tab: string;
  setTab: (tab: string) => void;
  /** Runs one write; its result becomes the saved version. Returns null when it failed (the notice says why). */
  act: (run: () => Promise<PublicationDetail>, success?: string) => Promise<PublicationDetail | null>;
  save: () => Promise<boolean>;
  reload: () => Promise<void>;
  /** Opens another publication (a new release) in place of this one. */
  openPublication: (id: Id) => void;
}

export type FormLoad = { kind: 'loading' } | { kind: 'failed'; message: string } | { kind: 'ready'; form: PublicationFormApi };

/** Loads a publication into the form and keeps it current: a newer revision in the mirror is fetched and, when the draft is clean, taken as is. */
export function usePublicationForm(publicationId: Id, openPublication: (id: Id) => void): FormLoad {
  const runtime = useRuntime();
  const [state, dispatch] = useReducer(formReducer, EMPTY_FORM);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const [tab, setTab] = useState('shared');
  const busy = usePublishingBusy((s) => !!s.busy[publicationId]);
  const rowRevision = usePublishing((s) => s.publications.find((p) => p.id === publicationId)?.revision ?? null);
  const rowProposalAt = usePublishing((s) => s.publications.find((p) => p.id === publicationId)?.proposalAt ?? null);
  const accounts = usePublishing((s) => s.accounts);
  const connections = usePublishing((s) => s.connections);
  const settings = usePublishing((s) => s.settings);
  const degraded = usePublishing((s) => s.degraded);
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    let live = true;
    getPublication(runtime, publicationId).then(
      (p) => live && dispatch({ type: 'load', publication: p }),
      (e: unknown) => live && setLoadError(publishingError(e).message),
    );
    return () => {
      live = false;
    };
  }, [runtime, publicationId]);

  const savedRevision = state.saved?.revision ?? null;
  useEffect(() => {
    if (savedRevision === null || rowRevision === null || rowRevision <= savedRevision) return;
    let live = true;
    getPublication(runtime, publicationId).then(
      (p) => live && dispatch({ type: 'external', publication: p }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [runtime, publicationId, rowRevision, savedRevision]);

  // A proposal (or its failure) is stored without raising the revision: fetch it when the row says one arrived, and keep the draft.
  const savedProposalAt = state.saved ? proposalAt(state.saved) : null;
  useEffect(() => {
    if (savedRevision === null || rowProposalAt === null || rowProposalAt === savedProposalAt) return;
    let live = true;
    getPublication(runtime, publicationId).then(
      (p) => live && dispatch({ type: 'annotated', publication: p }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [runtime, publicationId, rowProposalAt, savedProposalAt, savedRevision]);

  if (!state.saved || !state.draft) return loadError ? { kind: 'failed', message: loadError } : { kind: 'loading' };

  const reload = async () => {
    try {
      dispatch({ type: 'load', publication: await getPublication(runtime, publicationId) });
      setNotice(null);
    } catch (e) {
      setNotice({ tone: 'error', text: publishingError(e).message });
    }
  };

  const fail = (e: unknown) => {
    const error = publishingError(e);
    if (error.conflict && error.current) {
      // A clean draft takes the newer version; a dirty one keeps the draft and shows the conflict banner.
      if (isDirty(latest.current)) dispatch({ type: 'conflict', current: error.current });
      else void reload();
    }
    setNotice({ tone: 'error', text: error.message, issues: error.issues });
    return error;
  };

  const act: PublicationFormApi['act'] = async (run, success) => {
    setNotice(null);
    try {
      const saved = await run();
      dispatch({ type: 'saved', publication: saved });
      if (success) setNotice({ tone: 'status', text: success });
      return saved;
    } catch (e) {
      fail(e);
      return null;
    }
  };

  const save = async () => {
    const params = toUpdateParams(latest.current);
    if (!params) return true;
    const saved = await act(() => updatePublication(runtime, params.publicationId, params.revision, params.patch, params.destinations), PC.form.saved);
    return !!saved;
  };

  const tabs = formTabs(state.draft, accounts);
  const shownTab = tabs.some((t) => t.key === tab) ? tab : 'shared';

  return {
    kind: 'ready',
    form: {
      id: publicationId,
      state,
      saved: state.saved,
      draft: state.draft,
      dispatch,
      dirty: isDirty(state),
      busy,
      readOnly: !!degraded,
      owner: runtime.host.platform !== 'web',
      locked: publicationLocked(state.saved),
      accounts,
      connections,
      settings,
      notice,
      setNotice,
      tab: shownTab,
      setTab,
      act,
      save,
      reload,
      openPublication,
    },
  };
}

/** The conflict banner and the reason the form is read-only, above both columns. */
function Banners({ form }: { form: PublicationFormApi }) {
  return (
    <>
      {form.state.conflict ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-primary/40">
          <p className="min-w-0 flex-1 text-sm text-foreground">{PC.form.conflict}</p>
          <Button type="button" size="sm" variant="outline" disabled={form.busy} onClick={() => void form.reload()}>
            {PC.form.reload}
          </Button>
        </div>
      ) : null}
      {form.readOnly ? <p className="rounded-2xl bg-card p-3 text-sm text-muted-foreground ring-1 ring-foreground/10">{PC.form.readOnly}</p> : null}
    </>
  );
}

/**
 * The publication form (design §2.4, port of agentcut `PublicationForm`): the video and its pinned export on the left; accounts, the text tabs
 * (shared, one per account, delivery) and the publication time on the right; the sticky footer with save, readiness, review and send. Shared by
 * the calendar's dialog and the batch dialog.
 */
export function PublicationForm({
  form,
  footer,
  closeRefused,
  onArchived,
}: {
  form: PublicationFormApi;
  /** Replaces the footer (the batch dialog has its own); omitted = the standard footer. */
  footer?: ReactNode;
  closeRefused?: boolean;
  onArchived?: (publication: PublicationDetail) => void;
}) {
  const tabs = formTabs(form.draft, form.accounts);
  const go = useShell((s) => s.navigate);
  return (
    <div data-cc className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PublicationStatusBadge status={form.saved.status} />
        <a
          href="/settings/publishing"
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (!form.dirty) go('/settings/publishing');
          }}
          aria-disabled={form.dirty || undefined}
          title={form.dirty ? PC.form.saveOrDiscard : undefined}
          className="inline-flex items-center gap-1.5 rounded-full text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring aria-disabled:opacity-60"
        >
          <Link2 aria-hidden className="size-3.5" />
          {PC.form.connections}
        </a>
      </div>
      <Banners form={form} />
      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <PublicationVideo form={form} />
        <div className="flex min-w-0 flex-col gap-5">
          <PublicationAccounts form={form} />
          <Tabs value={form.tab} onValueChange={(value) => form.setTab(String(value))} className="gap-4">
            <TabsList aria-label={PC.form.tabsLabel} className="h-auto! max-w-full flex-wrap justify-start gap-1 rounded-2xl p-1">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="min-h-8 max-w-full flex-none">
                  {tab.network ? <NetworkIcon network={tab.network} /> : null}
                  <span className="truncate">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="shared">
              <PublicationText form={form} />
            </TabsContent>
            {form.draft.destinations.map((d) => (
              <TabsContent key={d.accountId} value={`destination:${d.accountId}`}>
                <PublicationDestinationFields form={form} destination={d} />
              </TabsContent>
            ))}
            <TabsContent value="delivery">
              <PublicationDelivery form={form} />
            </TabsContent>
          </Tabs>
          <PublicationTimeCard form={form} />
        </div>
      </div>
      {footer === undefined ? <PublicationFooter form={form} closeRefused={closeRefused} onArchived={onArchived} /> : footer}
    </div>
  );
}

