/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Slide, SlideId } from "../deck-contracts";

/** The part of the deck store the asset-undo helpers use. */
export interface AssetUndoStore {
  getSnapshot(): { meta: { order: SlideId[] } };
  getSlide(slideId: SlideId): Slide | undefined;
  getAsset(assetId: string): string | undefined;
  removeAssetEntry(assetId: string): void;
  setAssetEntry(assetId: string, value: string): void;
}

/** Drops assets an undoable edit uploaded (when nothing uses them) and puts them back on undo. */
export interface UnusedAssetUndoOperation {
  drop(): void;
  restore(): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    findUnusedUploadedAssets: (
      store: AssetUndoStore,
      assetIds: string[],
    ) => string[];
    createUnusedAssetUndoOperation: (
      store: AssetUndoStore,
      assetIds: string[],
    ) => UnusedAssetUndoOperation;
    filterReferencedDeckAssets: (
      slides: Record<SlideId, Slide>,
      order: SlideId[],
      assets: Record<string, string>,
    ) => Record<string, string>;
  }
}

export function installDocumentsAssetUndo(
  runtime: RuntimeBindings,
): () => void {
  function findUnusedUploadedAssets(
    store: AssetUndoStore,
    assetIds: string[],
  ): string[] {
    if (assetIds.length === 0) {
      return [];
    }
    let referenced = new Set<string>();
    for (let value of store.getSnapshot().meta.order) {
      let value2 = store.getSlide(value);
      if (value2) {
        (0, runtime.collectSlideAssetIds)(value2, referenced);
      }
    }
    return assetIds.filter((input) => !referenced.has(input));
  }
  function createUnusedAssetUndoOperation(
    store: AssetUndoStore,
    assetIds: string[],
  ): UnusedAssetUndoOperation {
    let removed: [string, string][] = [];
    return {
      drop: (): void => {
        for (let value of findUnusedUploadedAssets(store, assetIds)) {
          let value2 = store.getAsset(value);
          if (
            value2 === undefined ||
            removed.some(([input]) => input === value)
          ) {
            continue;
          }
          removed.push([value, value2]);
          store.removeAssetEntry(value);
        }
      },
      restore: (): void => {
        for (let [value, value2] of removed)
          store.setAssetEntry(value, value2);
        removed = [];
      },
    };
  }
  function filterReferencedDeckAssets(
    slides: Record<SlideId, Slide>,
    order: SlideId[],
    assets: Record<string, string>,
  ): Record<string, string> {
    let referenced = new Set<string>();
    for (let value of order) {
      let value2 = slides[value];
      if (value2) {
        (0, runtime.collectSlideAssetIds)(value2, referenced);
      }
    }
    let entries = Object.entries(assets).filter(([input]) =>
      referenced.has(input),
    );
    if (entries.length === Object.keys(assets).length) {
      return assets;
    } else {
      return Object.fromEntries(entries);
    }
  }
  bindRuntimeValue(
    runtime,
    "findUnusedUploadedAssets",
    () => findUnusedUploadedAssets,
  );
  bindRuntimeValue(
    runtime,
    "createUnusedAssetUndoOperation",
    () => createUnusedAssetUndoOperation,
  );
  bindRuntimeValue(
    runtime,
    "filterReferencedDeckAssets",
    () => filterReferencedDeckAssets,
  );
  return () => {};
}
