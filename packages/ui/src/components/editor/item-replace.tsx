import type { AssetRecord, Id, Sequence } from '@cuccut/protocol';
import { create } from 'zustand';
import { AssetReplaceDialog } from './asset-replace-dialog.tsx';

/**
 * The “Replace video / Replace image” entries on the canvas toolbar: open the media library in a single replace window that swaps only the selected clip (`itemId` in asset-replace.ts).
 * The window is mounted permanently on the timeline (timeline-menu.tsx, next to “Edit translation and redub”): the toolbar follows the selection frame, and after a replacement lands the old clip gets a new ID,
 * so the toolbar collapses; the window must not sit inside the toolbar, nor on the stage, so that pointer events in the window do not bubble up to the stage's selection and dragging.
 * The clip and asset are recorded on open: after landing the old clip is gone, but the window still finishes up (receipt and undo hint), regardless of whether the clip still exists.
 */
interface Target {
  itemId: Id;
  assetId: Id;
}

export const useItemReplace = create<{ target: Target | null }>(() => ({ target: null }));

export function openItemReplace(itemId: Id, assetId: Id): void {
  useItemReplace.setState({ target: { itemId, assetId } });
}

const close = () => useItemReplace.setState({ target: null });

export function ItemReplaceHost({ sequence, assets }: { sequence: Sequence; assets: Record<Id, AssetRecord> }) {
  const target = useItemReplace((s) => s.target);
  const asset = target ? assets[target.assetId] : undefined;
  if (!target || !asset || (asset.kind !== 'video' && asset.kind !== 'image')) return null;
  return (
    <AssetReplaceDialog key={target.itemId} asset={{ ...asset, kind: asset.kind }} itemId={target.itemId} sequence={sequence} assets={assets} onClose={close} />
  );
}
