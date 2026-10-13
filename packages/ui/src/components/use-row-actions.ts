import { useMemo } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { useRuntime } from '../runtime/context.tsx';
import { useShell } from '../state/shell-store.ts';
import { rowActions, type RowActions, type RowToasts } from './row-actions.ts';
import { S } from './shell-copy.ts';

const toasts: RowToasts = {
  negative: (message) => ToastQueue.negative(message, { timeout: 5000 }),
  undoable: (message, undo) =>
    ToastQueue.neutral(message, { timeout: 5000, actionLabel: S.sidebar.undo, onAction: undo, shouldCloseOnAction: true }),
};

/** The session and project row actions (pin, rename, archive with Undo) bound to this runtime and the shell. */
export function useRowActions(): RowActions {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  return useMemo(() => rowActions({ runtime, go, route: () => useShell.getState().route, toast: toasts }), [runtime, go]);
}
