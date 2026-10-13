import { useEffect } from 'react';
import type { AssetRecord, Id, JobRecord, Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ToastQueue } from '@react-spectrum/s2';
import { assetOnTimeline, loopSummary, musicBedOperations, placedSoundtrackJobs } from '../../model/music-bed.ts';
import { audioOutput } from '../../model/tools-tts.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useSoundtrackStore } from '../../state/soundtrack-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';
import { useEditorActions } from './editor-context.tsx';

/**
 * Once “生成配乐”(generate soundtrack) finishes, the result is added directly to this video's music track (product design §2.7 “生成配乐”, architecture design §7.9 “生成配乐的铺轨”(laying down the generated soundtrack)). The Runtime only imports the result as an asset.
 * Laying it on the timeline is an edit the UI commits in the editor: it is looped to fill the actual generated duration, with cross-faded seams and a fade-out at the end (music-bed.ts).
 * If the video is open when the task completes, it is laid down right away; if not, it is laid down the next time the video is opened. A video keeps only one soundtrack bed: generating another one replaces the previous bed (in the same transaction). Tasks already laid down are recorded
 * on this machine (soundtrack-store.ts) and marked in the instance's extension. If the asset is already on the timeline it is not laid down again. If it cannot be laid down, the editor shows one unified notice and does not retry. The toast states how it was laid, and it can be undone in one step.
 */
export function SoundtrackBed({ videoId, sequence, assets }: { videoId: Id; sequence: Sequence; assets: Record<Id, AssetRecord> }) {
  const { apply, undo } = useEditorActions();
  const jobs = useJobs((s) => s.jobs);
  const placed = useSoundtrackStore((s) => s.placed);
  const editable = useVideo((s) => canEdit(s.video));
  useEffect(() => {
    if (!editable) return;
    const job = jobs.find((j) => soundtrackReady(j, videoId) && !placed[j.jobId]);
    if (!job) return;
    const asset = assets[audioOutput(job)!.assetId!];
    // There is a beat between the task completing and the asset appearing in the snapshot; wait for the next one.
    if (!asset) return;
    const { markPlaced } = useSoundtrackStore.getState();
    // The timeline already has this task's bed (laid down by another window, or the local record was lost), or the user placed this material there themselves: do not lay it down again.
    if (placedSoundtrackJobs(sequence).has(job.jobId) || assetOnTimeline(sequence, asset.id)) {
      markPlaced(job.jobId);
      return;
    }
    const bed = musicBedOperations(sequence, asset, job.jobId);
    if (!bed) return;
    markPlaced(job.jobId);
    void apply(bed.operations, EditLabel.addSoundtrack()).then((receipt) => {
      if (!receipt) return;
      ToastQueue.positive(C.soundtrackAdded(asset.name, loopSummary(bed.layout, bed.totalSec)), {
        timeout: 8000,
        actionLabel: C.undo,
        onAction: () => void undo({ transaction: receipt.transactionId }),
        shouldCloseOnAction: true,
      });
    });
  }, [jobs, placed, editable, videoId, sequence, assets, apply, undo]);
  return null;
}

/** This video's “生成配乐”(generate soundtrack) task is done, and its result has been imported as an asset. */
export function soundtrackReady(job: JobRecord, videoId: Id): boolean {
  return job.kind === 'generateMusic' && job.videoId === videoId && job.state === 'completed' && !!audioOutput(job)?.assetId;
}
