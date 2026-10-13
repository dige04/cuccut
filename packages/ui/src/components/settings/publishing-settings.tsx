'use client';

import { useEffect, useId, useState } from 'react';
import { Archive, ArrowUpRight, Cable, CalendarClock, Loader2, Settings2 } from 'lucide-react';
import { formatRef, type PublishingCleanupResult, type PublishingSettings as Settings } from '@cuccut/protocol';
import { RouteLink } from '../../cc/components/page-chrome.tsx';
import { Button, buttonVariants } from '../../cc/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../cc/ui/dialog';
import { Input } from '../../cc/ui/input';
import { Skeleton } from '../../cc/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../cc/ui/tabs';
import { retentionSettings, settingsTabOf, type PublishingSettingsTab } from '../../model/publishing-settings.ts';
import { formatBytes } from '../../model/space.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { cleanupPublishing, publishingError, savePublishingSettings } from '../../runtime/publishing-commands.ts';
import { usePublishing } from '../../state/publishing-store.ts';
import { PC } from '../publishing/publishing-copy.ts';
import { PublishingAccounts } from './publishing-accounts.tsx';
import { PublishingSchedule } from './publishing-schedule.tsx';
import { Panel, PanelHeading, RowList, SettingsRow } from './settings-ui.tsx';

/**
 * `?tab=` of the address the app was opened with (a deep link such as `/settings/publishing?tab=schedule`). Read when the bundle loads, before the
 * shell rewrites the address to the route's own href, and used by the first Publishing section that mounts.
 */
let initialTab: PublishingSettingsTab | null = typeof window === 'undefined' ? null : settingsTabOf(window.location.search);


/** "Open calendar", the section header's action. */
export function OpenCalendarLink() {
  return (
    <span data-cc>
      <RouteLink route={{ tab: 'calendar' }} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        {PC.settings.openCalendar}
        <ArrowUpRight aria-hidden />
      </RouteLink>
    </span>
  );
}

/**
 * Settings → Publishing (design §2.5, agentcut `connections-view.tsx`): tabs for Accounts (connections and the accounts behind them), Schedule
 * (timezone, weekly times, spacing, defaults for new clips) and Advanced (archive retention, removing unused pinned exports). `?tab=` on the
 * address picks the first tab (local UI state). Everything reads the `publishing` mirror; while publishing is degraded the controls say why.
 */
export function PublishingSettings() {
  const runtime = useRuntime();
  const owner = runtime.host.platform !== 'web';
  const ready = usePublishing((s) => s.ready);
  const settings = usePublishing((s) => s.settings);
  const accounts = usePublishing((s) => s.accounts);
  const connections = usePublishing((s) => s.connections);
  const rows = usePublishing((s) => s.publications);
  const degraded = usePublishing((s) => s.degraded);
  const [tab, setTab] = useState<PublishingSettingsTab>(() => initialTab ?? 'accounts');
  // The deep link's tab applies once; later visits start on Accounts.
  useEffect(() => {
    initialTab = null;
  }, []);
  const readOnly = !!degraded;

  if (!ready || !settings) {
    return (
      <div data-cc role="status" aria-label={PC.settings.loading} className="flex flex-col gap-3">
        <Skeleton className="h-10 w-72 rounded-full" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    );
  }

  return (
    <div data-cc className="flex min-w-0 flex-col gap-5">
      {degraded ? (
        <p role="status" className="m-0 rounded-2xl bg-card p-3 text-sm text-foreground ring-1 ring-foreground/10">
          {formatRef(degraded, PC.form.readOnly)}
        </p>
      ) : null}
      <Tabs value={tab} onValueChange={(value) => setTab(value as PublishingSettingsTab)} className="gap-5">
        <TabsList aria-label={PC.settings.tabsLabel} className="max-w-full">
          <TabsTrigger value="accounts" className="px-2 text-xs sm:px-3 sm:text-sm">
            <Cable aria-hidden />
            {PC.settings.tabAccounts}
          </TabsTrigger>
          <TabsTrigger value="schedule" className="px-2 text-xs sm:px-3 sm:text-sm">
            <CalendarClock aria-hidden />
            {PC.settings.tabSchedule}
          </TabsTrigger>
          <TabsTrigger value="advanced" className="px-2 text-xs sm:px-3 sm:text-sm">
            <Settings2 aria-hidden />
            {PC.settings.tabAdvanced}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <PublishingAccounts owner={owner} readOnly={readOnly} accounts={accounts} connections={connections} rows={rows} />
        </TabsContent>
        <TabsContent value="schedule">
          <PublishingSchedule settings={settings} accounts={accounts} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="advanced">
          <PublishingAdvanced settings={settings} owner={owner} readOnly={readOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Advanced: how long archived publications are kept, and "Remove unused pinned exports" (desktop app only). */
function PublishingAdvanced({ settings, owner, readOnly }: { settings: Settings; owner: boolean; readOnly: boolean }) {
  const id = useId();
  const runtime = useRuntime();
  const [days, setDays] = useState(String(settings.archivedRetentionDays));
  const [base, setBase] = useState(settings.archivedRetentionDays);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [checking, setChecking] = useState(false);
  // What a cleanup would remove, shown for confirmation: it deletes for good, so it names what goes first (no Undo).
  const [pending, setPending] = useState<PublishingCleanupResult | null>(null);
  const [notice, setNotice] = useState<{ tone: 'status' | 'error'; text: string } | null>(null);
  const dirty = days.trim() !== String(base);

  // A clean field follows the saved value (another window or the agent changed it).
  useEffect(() => {
    if (settings.archivedRetentionDays === base) return;
    if (!dirty) setDays(String(settings.archivedRetentionDays));
    setBase(settings.archivedRetentionDays);
  }, [settings.archivedRetentionDays, base, dirty]);

  const next = retentionSettings(days, settings);
  const saveWhy = readOnly ? PC.form.readOnly : saving ? PC.form.busy : !dirty ? PC.settings.noChanges : !next ? PC.settings.daysInvalid : null;
  const cleanWhy = !owner ? PC.settings.ownerOnly : readOnly ? PC.form.readOnly : checking ? PC.settings.cleanupChecking : null;

  const save = async () => {
    if (!next) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await savePublishingSettings(runtime, next);
      setBase(saved.archivedRetentionDays);
      setDays(String(saved.archivedRetentionDays));
      setNotice({ tone: 'status', text: PC.settings.advancedSaved });
    } catch (e) {
      setNotice({ tone: 'error', text: publishingError(e).message });
    } finally {
      setSaving(false);
    }
  };
  const check = async () => {
    setChecking(true);
    setNotice(null);
    try {
      const preview = await cleanupPublishing(runtime, { dryRun: true });
      if (preview.publications || preview.files || preview.bytes) setPending(preview);
      else setNotice({ tone: 'status', text: PC.settings.cleanupNothing });
    } catch (e) {
      setNotice({ tone: 'error', text: publishingError(e).message });
    } finally {
      setChecking(false);
    }
  };
  const cleanup = async () => {
    setCleaning(true);
    setNotice(null);
    try {
      const result = await cleanupPublishing(runtime);
      setPending(null);
      setNotice({ tone: 'status', text: PC.settings.cleaned(result.publications, result.files) });
    } catch (e) {
      setPending(null);
      setNotice({ tone: 'error', text: publishingError(e).message });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Panel label={PC.settings.advancedTitle} className="flex flex-col gap-2 pb-1.5">
      <PanelHeading title={PC.settings.advancedTitle} hint={PC.settings.advancedHint} icon={<Archive />} />
      <RowList>
        <SettingsRow
          label={<label htmlFor={`${id}-days`}>{PC.settings.retention}</label>}
          note={!next && dirty ? <span className="text-destructive">{PC.settings.daysInvalid}</span> : undefined}
        >
          <Input
            id={`${id}-days`}
            type="number"
            inputMode="numeric"
            min={1}
            max={3650}
            step={1}
            className="w-28"
            value={days}
            disabled={readOnly || saving}
            aria-invalid={(!next && dirty) || undefined}
            onChange={(e) => setDays(e.target.value)}
          />
          <Button type="button" variant="outline" disabled={!!saveWhy} title={saveWhy ?? undefined} onClick={() => void save()}>
            {saving ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
            {PC.settings.saveAdvanced}
          </Button>
        </SettingsRow>
        <SettingsRow label={PC.settings.cleanup} desc={PC.settings.cleanupHint(settings.archivedRetentionDays)} note={cleanWhy ?? undefined}>
          <Button type="button" variant="outline" disabled={!!cleanWhy || cleaning} onClick={() => void check()}>
            {checking ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
            {checking ? PC.settings.cleanupChecking : PC.settings.cleanup}
          </Button>
        </SettingsRow>
      </RowList>
      {notice ? (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={notice.tone === 'error' ? 'm-0 pb-2 text-sm text-destructive' : 'm-0 pb-2 text-sm text-foreground'}>
          {notice.text}
        </p>
      ) : null}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !cleaning) setPending(null);
        }}
      >
        <DialogContent data-cc showCloseButton={!cleaning} className="gap-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{PC.settings.cleanupConfirmTitle}</DialogTitle>
            <DialogDescription>
              {pending ? PC.settings.cleanupConfirm(pending.publications, pending.files, formatBytes(pending.bytes)) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={cleaning} onClick={() => setPending(null)}>
              {PC.settings.cancel}
            </Button>
            <Button type="button" variant="destructive" disabled={cleaning} onClick={() => void cleanup()}>
              {cleaning ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
              {cleaning ? PC.settings.cleaning : PC.settings.cleanupSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
