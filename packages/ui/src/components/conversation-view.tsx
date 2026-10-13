import { useEffect, useState } from 'react';
import { DEFAULT_AGENT_MODE, RpcError, newId, nowIso, type AttachmentRef, type DesignAnnotation, type DesignSystemAnnotation, type Id, type SkillSendRef, type SlideAnnotation } from '@cuccut/protocol';
import { Button, ProgressCircle, ToastQueue } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { S } from './shell-copy.ts';
import { AGENT_PICKER, QUEUE_COPY } from '../copy.ts';
import { sendFailureMessage } from '../model/agent-skills.ts';
import { enqueueMessage } from '../model/message-queue.ts';
import { sentDesignAnnotations } from '../model/design-annotations.ts';
import { DESIGN } from '../model/design-copy.ts';
import { sentDesignSystemAnnotations } from '../model/design-system-annotations.ts';
import { DESIGN_SYSTEM } from '../model/design-system-copy.ts';
import { sentSlideAnnotations } from '../model/slide-annotations.ts';
import { SLIDES } from '../model/slides-copy.ts';
import { itemKey } from '../model/workspace.ts';
import { referenceDescription } from '../model/space-actions.ts';
import { useRuntime } from '../runtime/context.tsx';
import { drainQueue, sendQueuedMessageNow } from '../runtime/message-queue-runner.ts';
import { useConversationMeta, useDirectory } from '../state/directory-store.ts';
import { useDraftDesignAnnotationList, useDraftDesignAnnotations } from '../state/draft-design-annotations-store.ts';
import { useDraftDesignSystemAnnotationList, useDraftDesignSystemAnnotations } from '../state/draft-design-system-annotations-store.ts';
import { useDraftSlideAnnotationList, useDraftSlideAnnotations } from '../state/draft-slide-annotations-store.ts';
import { flushEditors } from '../state/editor-bridge.ts';
import { useTimelineItems, useTimelineLoaded } from '../state/timeline-store.ts';
import { useSetting } from '../state/settings-store.ts';
import { useShell } from '../state/shell-store.ts';
import { Composer } from './composer.tsx';
import { PackQuickActions } from './pack-quick-actions.tsx';
import { QueuedMessages } from './queued-messages.tsx';
import { useEditorReference } from './use-editor-reference.ts';
import { Thread } from './thread/thread.tsx';
import { ThreadEmpty } from './thread/thread-empty.tsx';

const view = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, minWidth: 0 });
const centered = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  flexGrow: 1,
  font: 'ui',
  color: 'gray-600',
});

/**
 * `autoFocus`: on mount, put the caret in the input box; the floating conversation that opens by default at the editor's bottom-right does not steal focus.
 * `quietSend`: a tab is open beside it (in the video editor, “Export” is the only yellow primary button on that screen), so the send button uses a neutral color.
 */
export function ConversationView({
  conversationId,
  autoFocus = true,
  quietSend = false,
}: {
  conversationId: string;
  autoFocus?: boolean;
  quietSend?: boolean;
}) {
  const runtime = useRuntime();
  const meta = useConversationMeta(conversationId);
  // If the conversation has never switched access mode, follow the default in settings (§3.12); if settings have not loaded yet, use the protocol's default.
  const defaultMode = useSetting('agent.defaultAccessMode') ?? DEFAULT_AGENT_MODE;
  const ready = useDirectory((s) => s.ready);
  const items = useTimelineItems(conversationId);
  const loaded = useTimelineLoaded(conversationId);
  const go = useShell((s) => s.go);
  // A conversation sharing a working directory with another one takes its source from that conversation (architecture design §3.10).
  const editor = useEditorReference({ conversationId: meta?.folderOf ?? conversationId, projectId: meta?.projectId ?? null });
  const slideAnnotations = useDraftSlideAnnotationList(conversationId);
  const designAnnotations = useDraftDesignAnnotationList(conversationId);
  const systemAnnotations = useDraftDesignSystemAnnotationList(conversationId);
  const [sendingNow, setSendingNow] = useState<Id | null>(null);

  useEffect(() => runtime.watchConversation(conversationId), [runtime, conversationId]);
  // If you are viewing a conversation when it completes, count it as read: clear “completed, unread”.
  const unread = meta?.unread ?? false;
  useEffect(() => {
    if (unread) void runtime.markRead(conversationId).catch(() => {});
  }, [runtime, conversationId, unread]);

  if (!meta) {
    return ready ? (
      <div className={centered}>
        <span>{S.conversationView.missing}</span>
        <Button variant="secondary" onPress={() => go({ tab: 'home', conversationId: null, projectId: null })}>
          {S.common.newSession}
        </Button>
      </div>
    ) : (
      <div className={centered}>
        <ProgressCircle isIndeterminate aria-label={S.common.loading} />
      </div>
    );
  }

  const busy = meta.activeTaskId !== null;
  // A conversation that has run a task cannot switch Agent again (a native conversation cannot be resumed across Agents, architecture design §3.11).
  const lockedTo = items.some((i) => i.kind === 'task') ? meta.driverId : null;

  /** Messages sent while busy are queued first, carrying the editor state at that moment, the selected skill and slides, design drafts and design-system annotations; they are sent in order once the task ends. */
  const enqueue = async (
    text: string,
    attachments: AttachmentRef[],
    skills: SkillSendRef[],
    notes: SlideAnnotation[],
    designNotes: DesignAnnotation[],
    systemNotes: DesignSystemAnnotation[],
  ) => {
    const context = await editor.capture();
    useShell.getState().setQueue(conversationId, (queue) =>
      enqueueMessage(queue, {
        id: newId('queue'),
        text,
        attachments,
        ...(context ? { context } : {}),
        ...(skills.length ? { skills } : {}),
        ...(notes.length ? { slideAnnotations: notes } : {}),
        ...(designNotes.length ? { designAnnotations: designNotes } : {}),
        ...(systemNotes.length ? { designSystemAnnotations: systemNotes } : {}),
        queuedAt: nowIso(),
      }),
    );
    editor.reset();
  };
  const reportQueueFailure = (message: string) => ToastQueue.negative(QUEUE_COPY.failed(message), { timeout: 5000 });

  /** A pack's quick action (pack design §2.6): sent like a typed message, queued behind a running task or earlier queued messages. */
  const sendQuick = async (text: string): Promise<boolean> => {
    if (busy || useShell.getState().queues[conversationId]?.length) {
      await enqueue(text, [], [], [], [], []);
      if (!busy)
        void drainQueue(runtime, conversationId).then((result) => {
          if (result.status === 'failed') reportQueueFailure(result.error);
        });
      return true;
    }
    try {
      await runtime.send(conversationId, text, await editor.capture());
      editor.reset();
      return true;
    } catch (error) {
      if (error instanceof RpcError && error.code === 'busy') {
        await enqueue(text, [], [], [], [], []);
        return true;
      }
      ToastQueue.negative(sendFailureMessage(error), { timeout: 5000 });
      return false;
    }
  };

  const sendNow = async (messageId: Id) => {
    setSendingNow(messageId);
    // A message with a skill does not interrupt (the protocol's steer does not accept skills); it stays queued until this turn ends. The hint gives this reason, not that the Agent does not support interrupting.
    const withSkill = !!useShell.getState().queues[conversationId]?.find((m) => m.id === messageId)?.skills?.length;
    try {
      const result = await sendQueuedMessageNow(runtime, conversationId, messageId);
      if (result.status === 'deferred')
        ToastQueue.neutral(withSkill ? QUEUE_COPY.skillWaits : QUEUE_COPY.steerUnsupported, { timeout: 5000 });
      else if (result.status === 'failed') reportQueueFailure(result.error);
    } finally {
      setSendingNow(null);
    }
  };

  return (
    <div className={view}>
      {loaded ? (
        <Thread
          items={items}
          conversationId={conversationId}
          running={busy}
          empty={<ThreadEmpty conversationId={conversationId} projectId={meta.projectId} folderOf={meta.folderOf} />}
        />
      ) : (
        <div className={centered}>
          <ProgressCircle isIndeterminate aria-label={S.conversationView.loadingSession} />
        </div>
      )}
      <Composer
        draftKey={conversationId}
        driverId={meta.driverId}
        model={meta.model}
        effort={meta.effort}
        lockedTo={lockedTo}
        onAgentChange={(change) =>
          void runtime.updateConversation(conversationId, change).catch((error: Error) => {
            const message = error instanceof RpcError && error.code === 'conflict' ? AGENT_PICKER.locked : S.conversationView.switchFailed(error.message);
            ToastQueue.negative(message, { timeout: 5000 });
          })
        }
        accessMode={meta.accessMode ?? defaultMode}
        onAccessModeChange={(accessMode) =>
          void runtime
            .updateConversation(conversationId, { accessMode })
            .catch((error: Error) => ToastQueue.negative(S.conversationView.accessModeFailed(error.message), { timeout: 5000 }))
        }
        busy={busy}
        queueWhileBusy
        quietSend={quietSend}
        stopping={meta.activity === 'stopping'}
        placeholder={busy ? QUEUE_COPY.busyPlaceholder : S.conversationView.placeholder}
        autoFocus={autoFocus}
        reference={editor.reference}
        spaceReferences={
          meta.pendingReferences?.length
            ? {
                items: meta.pendingReferences.map((ref) => ({ id: ref.entryId, label: ref.name, description: referenceDescription(ref) })),
                onClear: () =>
                  void runtime
                    .clearPendingReferences(conversationId)
                    .catch((error: Error) => ToastQueue.negative(S.conversationView.removeFailed(error.message), { timeout: 5000 })),
              }
            : null
        }
        slideAnnotations={{
          items: slideAnnotations.map((n) => ({ id: n.id, target: n.deck, anchor: n.anchor, label: n.label, text: n.text })),
          onRemove: (id) => useDraftSlideAnnotations.getState().remove(conversationId, id),
          onClear: () => useDraftSlideAnnotations.getState().clear(conversationId),
        }}
        designAnnotations={{
          items: designAnnotations.map((n) => ({ id: n.id, target: n.canvas, anchor: n.anchor, label: n.label, text: n.text })),
          onRemove: (id) => useDraftDesignAnnotations.getState().remove(conversationId, id),
          onClear: () => useDraftDesignAnnotations.getState().clear(conversationId),
        }}
        designSystemAnnotations={{
          items: systemAnnotations.map((n) => ({ id: n.id, target: n.system, anchor: n.anchor, section: n.section, label: n.label, text: n.text })),
          onRemove: (id) => useDraftDesignSystemAnnotations.getState().remove(conversationId, id),
          onClear: () => useDraftDesignSystemAnnotations.getState().clear(conversationId),
        }}
        mentionScope={{ projectId: meta.projectId, conversationId }}
        queue={<QueuedMessages conversationId={conversationId} sending={sendingNow} onSendNow={(id) => void sendNow(id)} />}
        offers={
          <PackQuickActions
            draftKey={conversationId}
            scope={{ conversationId: meta.folderOf ?? conversationId, projectId: meta.projectId ?? null }}
            onSend={sendQuick}
          />
        }
        beforeSend={async () => {
          // When carrying slides, design drafts or design-system annotations, first let the open editor save its changes (docs/design/slides §8.2, docs/design/canvas §8.2, §10.6):
          // the agent reads the version the user sees. While waiting, the text stays in the input box; if the save did not succeed, do not send, and say which ones (product design §3.2.4); input and annotations are kept.
          const slides = useDraftSlideAnnotations.getState().annotations[conversationId] ?? [];
          const designs = useDraftDesignAnnotations.getState().annotations[conversationId] ?? [];
          const systems = useDraftDesignSystemAnnotations.getState().annotations[conversationId] ?? [];
          if (!slides.length && !designs.length && !systems.length) return true;
          const [failedSlides, failedDesigns, failedSystems] = await Promise.all([
            flushEditors(slides.map((n) => itemKey({ kind: 'slides', target: n.deck }))),
            flushEditors(designs.map((n) => itemKey({ kind: 'design', target: n.canvas }))),
            flushEditors(systems.map((n) => itemKey({ kind: 'design-system', target: n.system }))),
          ]);
          if (failedSlides.length) ToastQueue.negative(SLIDES.flushFailed(failedSlides), { timeout: 5000 });
          if (failedDesigns.length) ToastQueue.negative(DESIGN.flushFailed(failedDesigns), { timeout: 5000 });
          if (failedSystems.length) ToastQueue.negative(DESIGN_SYSTEM.flushFailed(failedSystems), { timeout: 5000 });
          return !failedSlides.length && !failedDesigns.length && !failedSystems.length;
        }}
        onSend={async (input, attachments, skills) => {
          // Slides, design drafts and design-system annotations (§8.2, §10.6): if only annotations are attached with no text written, add a sentence; after sending (or queuing), remove them from the draft.
          const drafted = useDraftSlideAnnotations.getState().annotations[conversationId] ?? [];
          const draftedDesigns = useDraftDesignAnnotations.getState().annotations[conversationId] ?? [];
          const draftedSystems = useDraftDesignSystemAnnotations.getState().annotations[conversationId] ?? [];
          const notes = sentSlideAnnotations(drafted);
          const designNotes = sentDesignAnnotations(draftedDesigns);
          const systemNotes = sentDesignSystemAnnotations(draftedSystems);
          const text =
            input ||
            [notes.length ? SLIDES.message : '', designNotes.length ? DESIGN.message : '', systemNotes.length ? DESIGN_SYSTEM.message : '']
              .filter(Boolean)
              .join('\n');
          const sentNotes = () => {
            useDraftSlideAnnotations.getState().sent(conversationId, drafted.map((n) => n.id));
            useDraftDesignAnnotations.getState().sent(conversationId, draftedDesigns.map((n) => n.id));
            useDraftDesignSystemAnnotations.getState().sent(conversationId, draftedSystems.map((n) => n.id));
          };
          // If items are already queued ahead: put this one at the end to keep the order; if the conversation is empty, send the head of the queue first.
          if (busy || useShell.getState().queues[conversationId]?.length) {
            await enqueue(text, attachments, skills, notes, designNotes, systemNotes);
            sentNotes();
            if (!busy)
              void drainQueue(runtime, conversationId).then((result) => {
                if (result.status === 'failed') reportQueueFailure(result.error);
              });
            return true;
          }
          try {
            await runtime.send(
              conversationId,
              text,
              await editor.capture(),
              attachments.map((a) => a.id),
              undefined,
              skills,
              notes,
              designNotes,
              systemNotes,
            );
            editor.reset();
            sentNotes();
            return true;
          } catch (error) {
            // A task just started (from another window or entry point): queue this message so it is not lost.
            if (error instanceof RpcError && error.code === 'busy') {
              await enqueue(text, attachments, skills, notes, designNotes, systemNotes);
              sentNotes();
              return true;
            }
            ToastQueue.negative(sendFailureMessage(error), { timeout: 5000 });
            return false;
          }
        }}
        onStop={() => {
          if (!meta.activeTaskId) return;
          runtime.stop(meta.activeTaskId).catch((error: Error) => ToastQueue.negative(S.conversationView.stopFailed(error.message), { timeout: 5000 }));
        }}
      />
    </div>
  );
}
