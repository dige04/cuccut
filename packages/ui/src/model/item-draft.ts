import type {
  AudioMix,
  ConfettiProps,
  Crop,
  DrawProps,
  EmbeddedAudio,
  Fx,
  Id,
  Place,
  ProgressProps,
  Revision,
  Sequence,
  SequenceItem,
  ShapeProps,
  StickerProps,
  VisualizerProps,
} from '@cuccut/protocol';
import type { Json } from '../render/text-style.ts';

/**
 * Uncommitted property values during a drag (a slider is committed on release, a color panel on pointer-up): only overlaid on the preview and the property panel.
 * The draft records the sequence version it was based on; when the sequence changes version (commit succeeded, undo, or someone else edited it), the draft becomes invalid.
 */
export interface ItemDraft {
  itemId: Id;
  revision: Revision;
  patch: ItemPatch;
}

export interface ItemPatch {
  /** Position, size, angle, opacity and corner radius (overlaid field by field on `place`). */
  place?: Partial<Place>;
  /** Text style (replaced as a whole). */
  style?: Json;
  /** Shape (replaced as a whole). */
  shape?: ShapeProps;
  /** Kind parameters of generated elements (sound wave, progress bar, confetti, hand-drawn, sticker; replaced as a whole). */
  props?: Json;
  /** Composition parameters (replaced as a whole). */
  parameterValues?: Json;
  /** Mix of the audio instance. */
  mix?: Partial<AudioMix>;
  /** Sound that comes with the video, or sound emitted by the composition. */
  embeddedAudio?: Partial<EmbeddedAudio>;
  /** Picture effect (replaced as a whole; `null` removes it). */
  fx?: Fx | null;
  /** Crop of videos and images (replaced as a whole): when panning a video that fills the frame on the canvas, it follows the pointer. */
  crop?: Crop;
}

/** Drafts on the same clip and the same version are stacked together (after dragging one slider, while its commit has not returned, dragging another one does not snap the previous one back). */
export function mergeDraft(previous: ItemDraft | null, next: ItemDraft): ItemDraft {
  if (!previous || previous.itemId !== next.itemId || previous.revision !== next.revision) return next;
  const a = previous.patch;
  const b = next.patch;
  return {
    ...next,
    patch: {
      ...a,
      ...b,
      ...(a.place || b.place ? { place: { ...a.place, ...b.place } } : {}),
      ...(a.mix || b.mix ? { mix: { ...a.mix, ...b.mix } } : {}),
      ...(a.embeddedAudio || b.embeddedAudio ? { embeddedAudio: { ...a.embeddedAudio, ...b.embeddedAudio } } : {}),
    },
  };
}

/** Overlays drafts onto the sequence; returned as is when the draft does not belong to this version. */
export function applyDraft(sequence: Sequence, draft: ItemDraft | null): Sequence {
  if (!draft || draft.revision !== sequence.revision) return sequence;
  const index = sequence.items.findIndex((item) => item.id === draft.itemId);
  if (index < 0) return sequence;
  const items = [...sequence.items];
  items[index] = patchItem(items[index]!, draft.patch);
  return { ...sequence, items };
}

/** Overlays a patch onto one clip: only the fields that this kind of clip has. */
export function patchItem(item: SequenceItem, patch: ItemPatch): SequenceItem {
  if (item.type === 'audio') return patch.mix ? { ...item, mix: { ...item.mix, ...patch.mix } } : item;
  if (item.type === 'caption') return item;
  const moved = patch.place ? { ...item, place: { ...item.place, ...patch.place } } : item;
  const placed = patch.crop && (moved.type === 'video' || moved.type === 'image') ? { ...moved, crop: patch.crop } : moved;
  const props = patch.props;
  switch (placed.type) {
    case 'video':
      return withFx(
        patch.embeddedAudio ? { ...placed, embeddedAudio: { ...placed.embeddedAudio, ...patch.embeddedAudio } } : placed,
        patch,
      );
    case 'image':
    case 'placeholder':
    case 'whiteboard':
      return withFx(placed, patch);
    case 'sticker':
      return withFx(props ? { ...placed, sticker: props as unknown as StickerProps } : placed, patch);
    case 'text':
      return patch.style ? { ...placed, style: patch.style } : placed;
    case 'shape':
      return patch.shape ? { ...placed, shape: patch.shape } : placed;
    case 'visualizer':
      return props ? { ...placed, visualizer: props as unknown as VisualizerProps } : placed;
    case 'progress':
      return props ? { ...placed, progress: props as unknown as ProgressProps } : placed;
    case 'confetti':
      return props ? { ...placed, confetti: props as unknown as ConfettiProps } : placed;
    case 'draw':
      return props ? { ...placed, draw: props as unknown as DrawProps } : placed;
    case 'composition':
      return withFx(
        {
          ...placed,
          ...(patch.parameterValues ? { parameterValues: patch.parameterValues } : {}),
          ...(patch.embeddedAudio && placed.audio ? { audio: { ...placed.audio, ...patch.embeddedAudio } } : {}),
        },
        patch,
      );
  }
}

/** Sets or removes `fx` (`null` removes the field, consistent with what the engine writes to disk). */
function withFx<T extends { fx?: Fx }>(item: T, patch: ItemPatch): T {
  if (patch.fx === undefined) return item;
  if (patch.fx !== null) return { ...item, fx: patch.fx };
  const { fx: _gone, ...rest } = item;
  return rest as T;
}

/** Overlays several drafts onto the sequence (several items dragged together on the stage): applied one by one; a draft that does not belong to this version is skipped. */
export function applyDrafts(sequence: Sequence, drafts: readonly ItemDraft[]): Sequence {
  return drafts.reduce((shown, draft) => applyDraft(shown, draft), sequence);
}
