import { useState } from 'react';
import type { Id, PublicationRow } from '@cuccut/protocol';
import { useRuntime } from '../../runtime/context.tsx';
import { reschedulePublication } from '../../runtime/publishing-commands.ts';
import {
  moveDialogStart,
  planMove,
  undoRecord,
  type CalendarDrag,
  type CalendarUndo,
  type MovePlan,
} from '../../model/publishing-calendar.ts';
import { usePublishing } from '../../state/publishing-store.ts';
import { PC } from './publishing-copy.ts';

/** The move dialog's state: which destinations of which publication, and the day and time typed so far. */
export interface MoveDraft {
  publicationId: Id;
  destinationIds: Id[];
  day: string;
  time: string;
  needsTime: boolean;
}

/**
 * Moving publications on the calendar (port of agentcut `hooks/calendar-move.ts`): drop on a day keeps each account's time; a destination with no
 * time, or the Move button, opens the move dialog. A local move offers Undo, which names the revision the move saved, so a later change refuses it
 * instead of being overwritten.
 */
export function useCalendarMove({ timezone, reveal }: { timezone: string; reveal: (day: string) => void }) {
  const runtime = useRuntime();
  const [drag, setDragState] = useState<CalendarDrag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [move, setMove] = useState<MoveDraft | null>(null);
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<CalendarUndo | null>(null);
  const [moving, setMoving] = useState(false);

  const rowOf = (id: Id): PublicationRow | undefined => usePublishing.getState().publications.find((p) => p.id === id);
  const context = () => {
    const { accounts, connections } = usePublishing.getState();
    return { accounts, connections };
  };

  const apply = async (row: PublicationRow, plan: Extract<MovePlan, { kind: 'move' }>, day: string): Promise<boolean> => {
    setMoving(true);
    setError('');
    try {
      const saved = await reschedulePublication(runtime, row.id, row.revision, plan.placements);
      setUndo(undoRecord(plan.undo, saved.revision));
      reveal(day);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setMoving(false);
    }
  };

  const open = (row: PublicationRow, destinationIds: Id[], day: string) => {
    setError('');
    setMove({ publicationId: row.id, destinationIds, ...moveDialogStart(row, destinationIds, day, timezone) });
  };

  /** A drop on `day`: keeps each account's time, or opens the dialog when one has none. */
  const drop = async (dropped: CalendarDrag, day: string) => {
    setDragState(null);
    setOver(null);
    const row = rowOf(dropped.publicationId);
    if (!row) return;
    const plan = planMove(row, dropped.destinationIds, day, timezone, context());
    switch (plan.kind) {
      case 'move':
        await apply(row, plan, day);
        return;
      case 'dialog':
        open(row, dropped.destinationIds, day);
        return;
      case 'blocked':
        setError(plan.reason);
        return;
      case 'error':
        setError(plan.message);
        return;
      case 'noop':
        return;
    }
  };

  /** The move dialog's submit. */
  const submit = async () => {
    if (!move) return;
    const row = rowOf(move.publicationId);
    if (!row) {
      setError(PC.move.missing);
      return;
    }
    const plan = planMove(row, move.destinationIds, move.day, timezone, { ...context(), ...(move.time ? { time: move.time } : {}) });
    switch (plan.kind) {
      case 'move':
        if (await apply(row, plan, move.day)) setMove(null);
        return;
      case 'noop':
        setMove(null);
        return;
      case 'dialog':
        setError(PC.move.timeNeeded);
        return;
      case 'blocked':
        setError(plan.reason);
        return;
      case 'error':
        setError(plan.message);
        return;
    }
  };

  const undoMove = async () => {
    if (!undo) return;
    setMoving(true);
    setError('');
    try {
      await reschedulePublication(runtime, undo.publicationId, undo.revision, undo.placements);
      if (undo.day) reveal(undo.day);
      setUndo(null);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'PUBLICATION_CONFLICT' ? PC.calendar.undoFailed : (e as Error).message);
      setUndo(null);
    } finally {
      setMoving(false);
    }
  };

  return {
    drag,
    setDrag: (next: CalendarDrag | null) => {
      setDragState(next);
      if (!next) setOver(null);
    },
    over,
    setOver,
    move,
    setMove: (next: MoveDraft | null) => {
      if (!next) setError('');
      setMove(next);
    },
    error,
    clearError: () => setError(''),
    undo,
    dismissUndo: () => setUndo(null),
    moving,
    open,
    drop,
    submit,
    undoMove,
  };
}

export type CalendarMoveState = ReturnType<typeof useCalendarMove>;
