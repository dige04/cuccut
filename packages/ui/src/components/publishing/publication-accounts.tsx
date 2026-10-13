'use client';

import { Checkbox } from '../../cc/ui/checkbox';
import { networkLabel, providerLabel } from '../../model/publishing-labels.ts';
import type { PublicationFormApi } from './publication-form.tsx';
import { NetworkIcon } from './network-icon.tsx';
import { PC } from './publishing-copy.ts';

/**
 * Account tiles (design §2.4): one checkbox per account, "name · connection" with "· reconnect needed" or "· disabled". A disabled account can be
 * unticked but not ticked; once something was sent the accounts are frozen, and the reason shows under the tiles.
 */
export function PublicationAccounts({ form }: { form: PublicationFormApi }) {
  const { accounts, connections, draft } = form;
  const frozen = form.locked ? PC.form.locked : form.readOnly ? PC.form.readOnly : form.busy ? PC.form.busy : null;
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-3 text-sm font-medium text-foreground">{PC.form.accounts}</legend>
      {!accounts.length ? <p className="text-sm text-muted-foreground">{PC.form.noAccounts}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => {
          const selected = draft.destinations.some((d) => d.accountId === account.id);
          const connection = connections.find((c) => c.id === account.connectionId);
          const via = connection ? connection.name || providerLabel(connection.provider) : '';
          return (
            <Checkbox
              key={account.id}
              checked={selected}
              disabled={!!frozen || (account.disabled && !selected)}
              onCheckedChange={(on) => form.dispatch({ type: 'toggleAccount', account, on })}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-foreground/5 px-3 py-2 has-[:checked]:ring-1 has-[:checked]:ring-primary/40"
            >
              <span className="flex items-center gap-1.5 text-foreground">
                <NetworkIcon network={account.network} className="size-3.5" />
                {networkLabel(account.network)}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {via ? PC.form.accountTile(account.name, via) : account.name}
                {account.needsReconnect ? ` ${PC.form.reconnect}` : ''}
                {account.disabled ? ` ${PC.form.accountDisabled}` : ''}
              </span>
            </Checkbox>
          );
        })}
      </div>
      {frozen && accounts.length ? <p className="text-xs text-muted-foreground">{frozen}</p> : null}
    </fieldset>
  );
}
