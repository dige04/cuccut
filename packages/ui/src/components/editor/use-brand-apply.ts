import type { BrandContent, LibraryApplyResult, LibraryEntry, Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ToastQueue } from '@react-spectrum/s2';
import { frameAt, rootSequence } from '../../model/editor.ts';
import { isPlaceable, placeAsset } from '../../model/editor-ops.ts';
import { LOTTIE_SECONDS, brandPlacement, captionStyleTargets, lottieLayer } from '../../model/library-brand.ts';
import { libraryErrorText } from '../../model/library-entry.ts';
import { spanAtPlayhead } from '../../model/new-items.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { applyLibraryEntry, waitForAsset } from '../../runtime/library-commands.ts';
import { useEditor } from '../../state/editor-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { useEditorActions } from './editor-context.tsx';
import { useInsertVisual } from './use-insert-visual.ts';
import { BRAND_COPY as IB } from './brand-copy.ts';

function currentSequence(): Sequence | null {
  const snapshot = useVideo.getState().video?.state?.video;
  return snapshot ? rootSequence(snapshot) : null;
}

/**
 * Put a brand item into this video (architecture design §5.9): first copy it into the video with `library.applyToVideo` (one edit; later changes in the library do not affect the video), then place it by kind. Images, videos and image stickers go onto the timeline at the playhead; Lottie stickers create a new layer with the built-in player; fonts go only into the asset library. Caption style is set in the same edit, so this video's captions use it.
 */
export function useBrandApply(): (entry: LibraryEntry) => Promise<void> {
  const runtime = useRuntime();
  const { apply } = useEditorActions();
  const insert = useInsertVisual();
  return async (entry) => {
    const video = useVideo.getState().video;
    const sequence = currentSequence();
    if (!video?.videoId || !canEdit(video) || !sequence) return;
    const content = entry.content as BrandContent;
    const targets = content.kind === 'captionStyle' ? captionStyleTargets(sequence) : [];
    let result: LibraryApplyResult;
    try {
      result = await applyLibraryEntry(runtime, {
        videoId: video.videoId,
        entry: { library: 'brand', id: entry.id, version: entry.version },
        ...(targets.length ? { sequenceId: sequence.id, captionItemIds: targets } : {}),
      });
    } catch (error) {
      ToastQueue.negative(libraryErrorText(IB.actionPlace(content.name), error), { timeout: 6000 });
      return;
    }

    if (content.kind === 'captionStyle') {
      ToastQueue.positive(
        targets.length ? IB.appliedToCaptions(content.name, targets.length) : IB.copiedNoCaptions(content.name),
        { timeout: 4000 },
      );
      return;
    }
    const placement = brandPlacement(content);
    if (placement === 'import-only' || !result.assetId) {
      ToastQueue.positive(IB.copiedToAssets(content.name), { timeout: 4000 });
      return;
    }
    const asset = await waitForAsset(result.assetId);
    const fresh = currentSequence();
    if (!asset || !fresh) {
      ToastQueue.neutral(IB.copiedNotPlaced(content.name), { timeout: 5000 });
      return;
    }
    const frame = frameAt(useEditor.getState().playhead, fresh.fps);
    if (placement === 'lottie') {
      await insert(fresh, {
        span: spanAtPlayhead(fresh, frame, LOTTIE_SECONDS),
        layers: [lottieLayer(content.name, asset, fresh.canvas)],
        label: content.name,
        trackName: IB.elementsTrack,
      });
      return;
    }
    if (!isPlaceable(asset)) {
      ToastQueue.neutral(IB.copiedNotPlaceable(content.name), { timeout: 5000 });
      return;
    }
    const receipt = await apply(placeAsset(fresh, asset, frame), EditLabel.addNamed({ name: content.name }));
    if (receipt) ToastQueue.positive(IB.placedAtPlayhead(content.name), { timeout: 4000 });
  };
}
