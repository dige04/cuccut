import { useEffect, useMemo, useState } from 'react';
import { Button } from '../cc/ui/button.tsx';
import { itemLabel } from '../model/editor.ts';
import { packQuickActions, quickActionMessage, quickActionTooltip } from '../model/packs.ts';
import { useRuntime } from '../runtime/context.tsx';
import { loadPacks } from '../runtime/pack-commands.ts';
import { useContextTag, type ContextScope } from '../state/agent-context.ts';
import { useConnection } from '../state/connection-store.ts';
import { useEditor } from '../state/editor-store.ts';
import { usePacks } from '../state/packs-store.ts';
import { useShell } from '../state/shell-store.ts';
import { useVideo } from '../state/video-store.ts';
import { PACKS_COPY } from './settings/packs-copy.ts';

/**
 * The installed packs' quick actions as a row of neutral capsule chips above the composer (pack design §2.6), shown
 * while the draft is empty and hidden when no pack has any. One click sends the action's text as a message, with
 * `{selection}` replaced by the selected timeline item's name in quotes (one item selected in the video this session can
 * see), otherwise by "this video". The tooltip names the pack it comes from.
 *
 * `onSend` is the composer's own send path (a queued message while the agent works, a new session from the editor's
 * floating chat); it returns whether the message went.
 */
export function PackQuickActions({ draftKey, scope, onSend }: { draftKey: string; scope: ContextScope; onSend(text: string): Promise<boolean> }) {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const status = usePacks((s) => s.status);
  const packs = usePacks((s) => s.packs);
  const draft = useShell((s) => s.drafts[draftKey] ?? '');
  const selection = useSelectionName(scope);
  const actions = useMemo(() => packQuickActions(packs), [packs]);
  const [sending, setSending] = useState<string | null>(null);

  // The list is fetched once per connection; installs and removals write it back.
  useEffect(() => {
    if (connected && status === 'idle') void loadPacks(runtime);
  }, [runtime, connected, status]);

  if (!actions.length || draft.trim()) return null;

  const send = async (key: string, text: string) => {
    if (sending) return;
    setSending(key);
    try {
      await onSend(quickActionMessage(text, selection));
    } finally {
      setSending(null);
    }
  };

  return (
    <div data-cc role="group" aria-label={PACKS_COPY.quick.label} className="flex flex-wrap gap-1.5 pb-2">
      {actions.map((action) => (
        <Button
          key={action.key}
          type="button"
          variant="outline"
          size="sm"
          title={quickActionTooltip(action)}
          disabled={sending !== null || !connected}
          aria-busy={sending === action.key || undefined}
          className="max-w-full truncate"
          onClick={() => void send(action.key, action.text)}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}

/** The name of the one timeline item selected in the video this session can see (as the reference chip decides); null otherwise. */
function useSelectionName(scope: ContextScope): string | null {
  const tag = useContextTag(scope);
  const videoId = tag?.videoId ?? null;
  const itemId = useEditor((s) => (videoId && s.videoId === videoId && s.selection.length === 1 ? (s.selection[0] ?? null) : null));
  return useVideo((s) => {
    if (!itemId || s.video?.videoId !== videoId) return null;
    const snapshot = s.video.state?.video;
    if (!snapshot) return null;
    const item = snapshot.sequences[snapshot.rootSequenceId]?.items.find((i) => i.id === itemId);
    return item ? itemLabel(item, snapshot.assets, snapshot.documents) : null;
  });
}
