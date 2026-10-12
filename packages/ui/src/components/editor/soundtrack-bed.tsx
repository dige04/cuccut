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
 * 「生成配乐」做好后直接加进这部视频的音乐轨（产品设计 §2.7「生成配乐」、架构设计 §7.9「生成配乐的铺轨」）：Runtime 只把结果导入为素材，
 * 铺到时间线是界面在编辑器里提交的一笔编辑——按做出来的实际时长循环铺满、接缝交叉淡化、片尾淡出（music-bed.ts）。
 * 视频开着时任务一完成就铺；没开着时下次打开它再铺。一部视频只留一床配乐：再生成一段就换掉上一床（同一笔事务）。铺过的任务记在
 * 本机（soundtrack-store.ts）并标在实例的扩展里，素材已经在时间线上的也不再铺；铺不上去时编辑器统一提示、不再重试。吐司写明铺法，可以一步撤销。
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
    // 任务完成到素材出现在快照里有一拍，等下一次。
    if (!asset) return;
    const { markPlaced } = useSoundtrackStore.getState();
    // 时间线上已经有这个任务铺的（另一个窗口铺的、或本机记录丢了），或用户自己把这段素材放上去了：不再铺。
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

/** 这部视频的「生成配乐」任务做好了、结果已导入为素材。 */
export function soundtrackReady(job: JobRecord, videoId: Id): boolean {
  return job.kind === 'generateMusic' && job.videoId === videoId && job.state === 'completed' && !!audioOutput(job)?.assetId;
}
