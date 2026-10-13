'use client';

import type { DragEvent } from 'react';
import { CalendarArrowUp, Film, GripVertical } from 'lucide-react';
import { CALENDAR_DRAG_TYPE, calendarTime, FORMAT_NETWORK, type Id, type PublicationRow, type PublicationRowDestination, type PublishingAccount, type PublishingConnection } from '@cuccut/protocol';
import { cn } from 'cn';
import { Button } from '../../cc/ui/button';
import { canDrag, encodeDrag, moveBlock, type CalendarDrag } from '../../model/publishing-calendar.ts';
import { networkLabel } from '../../model/publishing-labels.ts';
import { NetworkIcon } from './network-icon.tsx';
import { PC } from './publishing-copy.ts';
import { PublicationStatusBadge } from './status-badge.tsx';
import { usePinnedExport } from './use-pinned-export.ts';

/**
 * One publication on the calendar (design §2.3, port of agentcut `calendar-entry.tsx`): thumbnail, label, status, then one row per destination shown
 * here (network, account, time). It drags as a group when every row can move; otherwise each row has its own Move button, which opens the move
 * dialog — there a row that cannot move says why. The keyboard path is the Move button.
 */
export function CalendarEntry({
  row,
  destinations,
  day,
  accounts,
  connections,
  timezone,
  compact = false,
  busy = false,
  onOpen,
  onMove,
  onDrag,
}: {
  row: PublicationRow;
  destinations: PublicationRowDestination[];
  /** The day this entry is shown on (null in Unscheduled). */
  day: string | null;
  accounts: readonly PublishingAccount[];
  connections: readonly PublishingConnection[];
  timezone: string;
  /** Inside a grid cell: smaller thumbnail, account names for screen readers only. */
  compact?: boolean;
  busy?: boolean;
  onOpen: () => void;
  onMove: (destinationIds: Id[]) => void;
  onDrag: (drag: CalendarDrag | null) => void;
}) {
  const group = canDrag({ row, destinations }, accounts, connections);
  const draggable = group && !busy;
  const ids = destinations.map((d) => d.id);
  const onDragStart = (event: DragEvent<HTMLElement>) => {
    if (!draggable) {
      event.preventDefault();
      return;
    }
    const drag = { publicationId: row.id, revision: row.revision, destinationIds: ids };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(CALENDAR_DRAG_TYPE, encodeDrag(drag));
    onDrag(drag);
  };
  return (
    <article
      aria-label={row.label}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={() => onDrag(null)}
      className={cn(
        'min-w-0 rounded-xl bg-foreground/[0.055] p-2 ring-1 ring-foreground/5',
        draggable && 'cursor-grab active:cursor-grabbing',
        busy && 'opacity-70',
      )}
    >
      <button
        type="button"
        aria-label={PC.calendar.openEntry(row.label)}
        onClick={onOpen}
        className="flex min-h-8 w-full items-start gap-2 rounded-lg text-left outline-none focus-visible:outline-2 focus-visible:outline-ring"
      >
        <EntryThumbnail row={row} compact={compact} />
        <span title={row.label} className={cn('min-w-0 text-xs leading-snug font-medium break-words text-foreground', compact && 'line-clamp-2')}>
          {row.label}
        </span>
      </button>
      <div className="mt-2">
        <PublicationStatusBadge status={row.status} />
      </div>
      {destinations.length ? (
        <ul className="mt-2 space-y-1">
          {destinations.map((d) => {
            const account = accounts.find((a) => a.id === d.accountId);
            const network = account?.network ?? FORMAT_NETWORK[d.format];
            const name = account ? `${account.name} · ${networkLabel(network)}` : networkLabel(network);
            const blocked = moveBlock(row, d, accounts, connections);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1" title={name}>
                  <NetworkIcon network={network} className="size-3.5" />
                  <span className={compact ? 'sr-only' : 'min-w-0 break-words'}>{name}</span>
                </span>
                <span className="tabular-nums">{d.at ? calendarTime(d.at, timezone) : PC.calendar.noTime}</span>
                {!group ? (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    disabled={busy}
                    aria-label={PC.calendar.moveEntry(`${row.label} · ${name}`)}
                    title={blocked ?? undefined}
                    className={cn(blocked && 'opacity-60')}
                    onClick={() => onMove([d.id])}
                  >
                    <CalendarArrowUp aria-hidden />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {group ? (
        <div className="mt-1 flex items-center justify-between gap-1">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={busy}
            aria-label={PC.calendar.moveEntry(row.label)}
            onClick={() => onMove(ids)}
          >
            <CalendarArrowUp aria-hidden />
            {day ? PC.calendar.move : PC.calendar.chooseDay}
          </Button>
          <GripVertical aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        </div>
      ) : null}
    </article>
  );
}

/** The pinned export's first frame, or a Film icon (grid cells skip the frame: a month can hold many entries). */
function EntryThumbnail({ row, compact }: { row: PublicationRow; compact: boolean }) {
  const handle = usePinnedExport(row.id, compact ? null : (row.exportPosterId ?? `r${row.revision}`));
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/30', compact ? 'size-6' : 'size-8')}>
      {handle ? (
        <video src={`${handle.url}#t=0.1`} preload="metadata" muted playsInline aria-hidden className="size-full object-cover" />
      ) : (
        <Film aria-hidden strokeWidth={1.5} className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
