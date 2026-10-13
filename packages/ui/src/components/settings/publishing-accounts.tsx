'use client';

import { useId, useState } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { BadgeCheck, Cable, Hand, Plus } from 'lucide-react';
import {
  formatRef,
  PUBLISHING_NETWORKS,
  SUPPORTED_PUBLISHING_PROVIDERS,
  type PublicationRow,
  type PublishingAccount,
  type PublishingConnection,
  type PublishingNetwork,
  type PublishingProvider,
} from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Disclosure } from '../../cc/ui/disclosure';
import { Input } from '../../cc/ui/input';
import { networkLabel, providerLabel } from '../../model/publishing-labels.ts';
import {
  accountFieldsBlock,
  accountInUse,
  accountRowLabel,
  confirmAccountParams,
  connectionInUse,
  linkBlock,
  linkOptions,
  ownerBlock,
  removeBlock,
} from '../../model/publishing-settings.ts';
import { useRuntime } from '../../runtime/context.tsx';
import {
  linkAccount,
  publishingError,
  removeAccount,
  removeConnection,
  restoreAccount,
  restoreConnection,
  saveAccount,
  saveConnection,
} from '../../runtime/publishing-commands.ts';
import { NetworkIcon } from '../publishing/network-icon.tsx';
import { PC } from '../publishing/publishing-copy.ts';
import { PublishingSelect } from '../publishing/publishing-select.tsx';
import { Panel, PanelHeading } from './settings-ui.tsx';

interface Context {
  owner: boolean;
  readOnly: boolean;
  accounts: PublishingAccount[];
  connections: PublishingConnection[];
  rows: PublicationRow[];
}

const fail = (e: unknown) => ToastQueue.negative(publishingError(e).message, { timeout: 6000 });

/**
 * Settings → Publishing → Accounts (design §2.5, agentcut `connections-view.tsx`): the delivery routes and the accounts behind them. Phase 1 offers
 * one route, "By hand". Adding, removing, disabling and linking are the owner's (desktop app); a browser session sees them with the reason.
 * Removing a connection or an account acts at once and offers Undo; it is refused, with the reason, while a delivery that is not settled uses it.
 */
export function PublishingAccounts(context: Context) {
  const { connections } = context;
  const block = ownerBlock(context);
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <h3 className="m-0 text-sm font-medium text-foreground">{PC.settings.connections}</h3>
          <p className="m-0 mt-1 max-w-prose text-xs text-muted-foreground">{PC.settings.manualHint}</p>
        </div>
        {connections.length > 0 && !adding ? (
          <Button type="button" size="sm" variant="outline" disabled={!!block} title={block ?? undefined} onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {PC.settings.addConnection}
          </Button>
        ) : null}
      </div>
      {block ? <p className="text-xs text-muted-foreground">{block}</p> : null}
      {adding ? <NewConnection onDone={() => setAdding(false)} /> : null}
      {!connections.length && !adding ? (
        <Panel label={PC.settings.emptyTitle} className="flex flex-col items-start gap-3 py-8">
          <Cable aria-hidden className="size-6 text-muted-foreground" />
          <div>
            <h3 className="m-0 text-sm font-medium text-foreground">{PC.settings.emptyTitle}</h3>
            <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">{PC.settings.emptyBody}</p>
          </div>
          <Button type="button" disabled={!!block} onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {PC.settings.addFirst}
          </Button>
          {block ? <p className="text-xs text-muted-foreground">{block}</p> : null}
        </Panel>
      ) : null}
      {connections.map((connection) => (
        <ConnectionCard key={connection.id} connection={connection} context={context} />
      ))}
    </div>
  );
}

/** "Add connection": the route ("Publish through"; phase 1 only By hand) and its name. */
function NewConnection({ onDone }: { onDone: () => void }) {
  const id = useId();
  const runtime = useRuntime();
  const [provider, setProvider] = useState<PublishingProvider>(SUPPORTED_PUBLISHING_PROVIDERS[0]!);
  const [name, setName] = useState(() => providerLabel(SUPPORTED_PUBLISHING_PROVIDERS[0]!));
  const [busy, setBusy] = useState(false);
  const why = accountFieldsBlock({ name });
  const submit = async () => {
    setBusy(true);
    try {
      const saved = await saveConnection(runtime, { provider, name: name.trim() });
      ToastQueue.positive(PC.settings.connectionAdded(saved.name), { timeout: 5000 });
      onDone();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel label={PC.settings.newConnection}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!why && !busy) void submit();
        }}
      >
        <h3 className="m-0 text-sm font-medium text-foreground">{PC.settings.newConnection}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 text-sm">
            <label htmlFor={`${id}-provider`} className="block">
              {PC.settings.publishThrough}
            </label>
            <PublishingSelect
              id={`${id}-provider`}
              value={provider}
              disabled={busy}
              options={SUPPORTED_PUBLISHING_PROVIDERS.map((value) => ({ value, label: providerLabel(value) }))}
              onChange={(value) => {
                setProvider(value);
                setName(providerLabel(value));
              }}
            />
          </div>
          <div className="space-y-1.5 text-sm">
            <label htmlFor={`${id}-name`} className="block">
              {PC.settings.connectionName}
            </label>
            <Input id={`${id}-name`} value={name} disabled={busy} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!!why || busy}>
            {PC.settings.saveConnection}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onDone}>
            {PC.settings.cancel}
          </Button>
          {why ? <span className="text-xs text-muted-foreground">{why}</span> : null}
        </div>
      </form>
    </Panel>
  );
}

function ConnectionCard({ connection, context }: { connection: PublishingConnection; context: Context }) {
  const runtime = useRuntime();
  const [busy, setBusy] = useState(false);
  const accounts = context.accounts.filter((a) => a.connectionId === connection.id);
  const removeWhy = removeBlock({ ...context, busy, inUse: connectionInUse(connection.id, context.accounts, context.rows) });
  const remove = async () => {
    setBusy(true);
    try {
      const removed = await removeConnection(runtime, connection.id);
      ToastQueue.neutral(PC.settings.removedConnection(removed.connection.name), {
        timeout: 8000,
        actionLabel: PC.settings.undo,
        shouldCloseOnAction: true,
        onAction: () => void restoreConnection(runtime, removed).catch(fail),
      });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const Icon = connection.provider === 'manual' ? Hand : Cable;
  return (
    <Panel label={connection.name} className="flex flex-col gap-4">
      <PanelHeading
        icon={<Icon />}
        title={connection.name}
        hint={[
          providerLabel(connection.provider) === connection.name ? '' : providerLabel(connection.provider),
          connection.configured ? PC.settings.connectionReady : PC.settings.connectionNeedsSetup,
          PC.settings.connectionAccounts(accounts.length),
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <Button type="button" size="sm" variant="ghost" disabled={!!removeWhy} title={removeWhy ?? undefined} onClick={() => void remove()}>
            {PC.settings.removeConnection}
          </Button>
        }
      />
      {removeWhy && removeWhy !== ownerBlock(context) ? <p className="m-0 text-xs text-muted-foreground">{removeWhy}</p> : null}
      {connection.error || connection.errorRef ? (
        <p className="m-0 text-sm text-destructive">{connection.errorRef ? formatRef(connection.errorRef, connection.error ?? '') : connection.error}</p>
      ) : null}
      {accounts.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {accounts.map((account) => (
            <AccountItem key={account.id} account={account} context={context} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-xs text-muted-foreground">{PC.settings.noAccounts}</p>
      )}
      <NewAccount connection={connection} context={context} />
    </Panel>
  );
}

function AccountItem({ account, context }: { account: PublishingAccount; context: Context }) {
  const id = useId();
  const runtime = useRuntime();
  const [busy, setBusy] = useState(false);
  const owner = ownerBlock({ ...context, busy });
  const removeWhy = removeBlock({ ...context, busy, inUse: accountInUse(account.id, context.rows) });
  const linkWhy = linkBlock(account, context.accounts, { ...context, busy });
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    run(async () => {
      const removed = await removeAccount(runtime, account.id);
      ToastQueue.neutral(PC.settings.removedAccount(removed.account.name), {
        timeout: 8000,
        actionLabel: PC.settings.undo,
        shouldCloseOnAction: true,
        onAction: () => void restoreAccount(runtime, removed).catch(fail),
      });
    });
  const confirm = () =>
    run(async () => {
      const saved = await saveAccount(runtime, confirmAccountParams(account));
      ToastQueue.positive(PC.settings.accountConfirmed(saved.name), { timeout: 5000 });
    });
  const toggle = () =>
    run(() =>
      saveAccount(runtime, {
        id: account.id,
        connectionId: account.connectionId,
        network: account.network,
        name: account.name,
        remoteId: account.remoteId,
        disabled: !account.disabled,
      }),
    );
  return (
    <li className="space-y-2 rounded-2xl bg-foreground/[0.035] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <NetworkIcon network={account.network} className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 basis-40 text-foreground">
          {accountRowLabel(account)}
          <span className="block truncate text-xs text-muted-foreground select-text">{account.remoteId}</span>
        </span>
        {account.needsReconnect ? (
          <Button type="button" size="sm" variant="outline" disabled={!!owner} title={owner ?? undefined} onClick={() => void confirm()}>
            <BadgeCheck aria-hidden />
            {PC.settings.confirmAccount}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" disabled={!!owner} title={owner ?? undefined} onClick={() => void toggle()}>
          {account.disabled ? PC.settings.enable : PC.settings.disable}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!!removeWhy} title={removeWhy ?? undefined} onClick={() => void remove()}>
          {PC.settings.removeAccount}
        </Button>
      </div>
      {account.needsReconnect ? <p className="m-0 text-xs text-muted-foreground">{PC.settings.confirmAccountHint}</p> : null}
      {removeWhy && removeWhy !== owner ? <p className="m-0 text-xs text-muted-foreground">{removeWhy}</p> : null}
      <Disclosure variant="plain" summary={PC.settings.linkRoute}>
        <div className="space-y-1.5 pt-1 text-xs">
          <label htmlFor={`${id}-link`} className="block text-muted-foreground">
            {PC.settings.linkLabel}
          </label>
          <PublishingSelect
            id={`${id}-link`}
            value={account.equivalentTo ?? ''}
            disabled={!!linkWhy}
            options={linkOptions(account, context.accounts, context.connections)}
            onChange={(value) => void run(() => linkAccount(runtime, account.id, value || null))}
          />
          <p className="m-0 text-muted-foreground">{linkWhy ?? PC.settings.linkHint}</p>
        </div>
      </Disclosure>
    </li>
  );
}

/** "Add an account": network, account name and the exact handle or channel ID. */
function NewAccount({ connection, context }: { connection: PublishingConnection; context: Context }) {
  const id = useId();
  const runtime = useRuntime();
  const [network, setNetwork] = useState<PublishingNetwork>('youtube');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const why = ownerBlock({ ...context, busy }) ?? accountFieldsBlock({ name, handle });
  const submit = async () => {
    setBusy(true);
    setStatus('');
    try {
      const saved = await saveAccount(runtime, { connectionId: connection.id, network, name: name.trim(), remoteId: handle.trim() });
      setName('');
      setHandle('');
      setStatus(PC.settings.accountAdded(saved.name));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Disclosure summary={PC.settings.addAccount} variant="plain">
      <form
        className="space-y-3 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!why) void submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 text-sm">
            <label htmlFor={`${id}-network`} className="block">
              {PC.settings.network}
            </label>
            <PublishingSelect
              id={`${id}-network`}
              value={network}
              disabled={busy || !context.owner}
              options={PUBLISHING_NETWORKS.map((value) => ({ value, label: networkLabel(value) }))}
              onChange={setNetwork}
            />
          </div>
          <div className="space-y-1.5 text-sm">
            <label htmlFor={`${id}-name`} className="block">
              {PC.settings.accountName}
            </label>
            <Input id={`${id}-name`} value={name} maxLength={200} disabled={busy || !context.owner} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5 text-sm">
            <label htmlFor={`${id}-handle`} className="block">
              {PC.settings.handle}
            </label>
            <Input
              id={`${id}-handle`}
              value={handle}
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              disabled={busy || !context.owner}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline" disabled={!!why}>
            <Plus aria-hidden />
            {PC.settings.addAccountSubmit}
          </Button>
          {why ? <span className="text-xs text-muted-foreground">{why}</span> : null}
          <span role="status" className="text-xs text-foreground empty:hidden">
            {status}
          </span>
        </div>
      </form>
    </Disclosure>
  );
}
