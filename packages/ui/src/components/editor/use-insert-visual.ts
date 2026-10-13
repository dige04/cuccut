import type { FrameSpan, Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ToastQueue } from '@react-spectrum/s2';
import { rootSequence } from '../../model/editor.ts';
import { formatClock } from '../../model/format.ts';
import { createdItemIds, insertVisual, type VisualLayer } from '../../model/new-items.ts';
import { useEditor } from '../../state/editor-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { useEditorActions } from './editor-context.tsx';
import { ELEMENTS_COPY as EL } from './elements-copy.ts';

export interface InsertRequest {
  span: FrameSpan;
  layers: readonly VisualLayer[];
  /** Name used in undo records and hints (“Sticker · Heart”). */
  label: string;
  /** What the newly created track is called. */
  trackName?: string;
  /** Which layer is selected after creation (text presets select the first text layer). */
  selectLayer?: number;
}

/**
 * “Click to create” from the Elements and Text panels (prototype §14): create at the playhead, select it, and switch to the property page. The hint includes start and end, plus “Undo”.
 * The receipt can arrive before the video event, so the ID to select is taken from the receipt; then tracks and documents are filtered by the new video.
 */
export function useInsertVisual(): (sequence: Sequence, request: InsertRequest) => Promise<void> {
  const { apply, undo } = useEditorActions();
  return async (sequence, { span, layers, label, trackName, selectLayer = 0 }) => {
    const receipt = await apply(insertVisual(sequence, span, layers, trackName), EditLabel.addNamed({ name: label }));
    if (!receipt) return;
    const snapshot = useVideo.getState().video?.state?.video;
    const fresh = (snapshot && rootSequence(snapshot)) ?? sequence;
    const ids = createdItemIds(receipt.createdIds, fresh);
    const pick = ids[selectLayer] ?? ids[0];
    useEditor.getState().select(pick ? [pick] : []);
    const perSecond = sequence.fps.num / sequence.fps.den;
    const start = span.fromFrame / perSecond;
    const end = (span.fromFrame + span.durationFrames) / perSecond;
    ToastQueue.positive(EL.added(label, formatClock(start), formatClock(end)), {
      timeout: 5000,
      actionLabel: EL.undo,
      onAction: () => void undo({ transaction: receipt.transactionId }),
      shouldCloseOnAction: true,
    });
  };
}
