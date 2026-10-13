'use client';

import { useId } from 'react';
import { FORMAT_NETWORK, type PublicationRow, type PublishingAccount, type PublishingConnection } from '@cuccut/protocol';
import { Button } from '../../cc/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../cc/ui/dialog';
import { Input } from '../../cc/ui/input';
import { moveBlock } from '../../model/publishing-calendar.ts';
import { networkLabel, timezoneLabel } from '../../model/publishing-labels.ts';
import { CivilDatePicker } from './civil-date-picker.tsx';
import { NetworkIcon } from './network-icon.tsx';
import { PC } from './publishing-copy.ts';
import type { MoveDraft } from './use-calendar-move.ts';

/**
 * "Move publication" (design §2.3, port of agentcut `calendar-move-dialog.tsx`): the keyboard path for moving, and where a drop lands when an account
 * has no time. An empty time keeps each account's own time on the new day. An account that cannot move stays listed with its reason, and the submit
 * button says why it is unavailable.
 */
export function CalendarMoveDialog({
  move,
  row,
  accounts,
  connections,
  timezone,
  today,
  busy,
  error,
  onChange,
  onSubmit,
  onClose,
}: {
  move: MoveDraft | null;
  row: PublicationRow | undefined;
  accounts: readonly PublishingAccount[];
  connections: readonly PublishingConnection[];
  timezone: string;
  today: string;
  busy: boolean;
  error: string;
  onChange: (move: MoveDraft) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const id = useId();
  const destinations = row && move ? row.destinations.filter((d) => move.destinationIds.includes(d.id)) : [];
  const blocks = row ? destinations.map((d) => moveBlock(row, d, accounts, connections)) : [];
  const blocked = !row || !destinations.length ? PC.move.missing : (blocks.find((reason) => reason) ?? null);
  return (
    <Dialog
      open={!!move}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent data-cc showCloseButton={!busy} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{PC.move.title}</DialogTitle>
          <DialogDescription>{row ? PC.move.lead(row.label) : PC.move.missing}</DialogDescription>
        </DialogHeader>
        {move ? (
          <form
            id={`${id}-form`}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && !blocked) onSubmit();
            }}
          >
            {destinations.length ? (
              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-sm">{PC.move.accounts}</legend>
                <ul className="space-y-1.5">
                  {destinations.map((d, i) => {
                    const account = accounts.find((a) => a.id === d.accountId);
                    const network = account?.network ?? FORMAT_NETWORK[d.format];
                    return (
                      <li key={d.id} className="rounded-xl bg-foreground/5 px-3 py-2 text-xs">
                        <span className="flex items-center gap-1.5 text-foreground">
                          <NetworkIcon network={network} className="size-3.5" />
                          {account ? `${account.name} · ${networkLabel(network)}` : networkLabel(network)}
                        </span>
                        {blocks[i] ? <span className="mt-1 block text-muted-foreground">{blocks[i]}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ) : null}
            <div className="space-y-1.5 text-sm">
              <label htmlFor={`${id}-day`}>{PC.move.day}</label>
              <CivilDatePicker
                id={`${id}-day`}
                label={PC.move.day}
                value={move.day}
                today={today}
                disabled={busy || !!blocked}
                onChange={(day) => onChange({ ...move, day })}
              />
            </div>
            <div className="space-y-1.5 text-sm">
              <label htmlFor={`${id}-time`}>{PC.move.time}</label>
              <Input
                id={`${id}-time`}
                type="time"
                value={move.time}
                disabled={busy || !!blocked}
                className="scheme-dark tabular-nums"
                aria-describedby={`${id}-time-hint`}
                onChange={(event) => onChange({ ...move, time: event.target.value })}
              />
              <p id={`${id}-time-hint`} className="text-xs text-muted-foreground">
                {PC.time.allTimesIn(timezoneLabel(timezone))} {move.time ? null : move.needsTime ? PC.move.timeNeeded : PC.move.keepTimes}
              </p>
            </div>
            {error ? (
              <p role="alert" className="text-sm whitespace-pre-wrap text-destructive">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
        <DialogFooter className="items-center">
          {blocked ? <p className="me-auto text-xs text-muted-foreground sm:max-w-60">{blocked}</p> : null}
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {PC.move.cancel}
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={busy || !!blocked}>
            {busy ? PC.move.moving : PC.move.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
