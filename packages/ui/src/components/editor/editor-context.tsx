import { createContext, useContext } from 'react';
import type { EditOperation, Localized, TransactionReceipt, UndoTarget } from '@cuccut/protocol';
import type { PreviewEngine } from './preview-engine.ts';

/**
 * Actions shared by the parts of the editor: playback and seeking go through the preview engine; edits go through the video controller (commands are queued and carry the latest version number). Video content, selection and other state live in the store, and each part subscribes to what it needs.
 */
export interface EditorActions {
  engine: PreviewEngine;
  /** Seek the playhead (seconds). If playing, playback continues after the seek. */
  seek(seconds: number): void;
  togglePlay(): void;
  pause(): void;
  /** Submit one edit. The edit name is taken from the `editLabel` catalog (with references, so readers display it in their own language). On failure the editor shows the error uniformly; here it returns null. */
  apply(operations: EditOperation[], label?: Localized): Promise<TransactionReceipt | null>;
  undo(target: UndoTarget): Promise<TransactionReceipt | null>;
}

export const EditorContext = createContext<EditorActions | null>(null);

export function useEditorActions(): EditorActions {
  const actions = useContext(EditorContext);
  if (!actions) throw new Error('EditorContext is missing'); // i18n-ignore: development-time assertion, not shown to users
  return actions;
}
