import { useEffect, useMemo, useState } from 'react';
import type { BrandContent, LibraryEntry, LibraryEntrySummary } from '@cuccut/protocol';
import { isDynamicSticker } from '../../model/library-brand.ts';
import { entryKey } from '../../model/library-entry.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { getLibraryEntry } from '../../runtime/library-commands.ts';
import { useLibrary } from '../../state/library-store.ts';

export interface BrandSticker {
  summary: LibraryEntrySummary;
  entry: LibraryEntry;
  /** Goes to the “Animated stickers” page (Lottie); otherwise goes to the “Stickers” page. */
  dynamic: boolean;
}

/**
 * Stickers in the brand library (the element page's “My stickers”): the summary has no file type, so images and Lottie cannot be told apart. Each one is read individually (cached per version). An entry that cannot be read is not shown. Before `ready`, do not say “none yet”: the library snapshot or entries are still on the way. Order matches the brand page (by name).
 */
export function useBrandStickers(): { ready: boolean; stickers: BrandSticker[] } {
  const runtime = useRuntime();
  const libraryReady = useLibrary((s) => s.ready);
  const summaries = useLibrary((s) => s.brand);
  const list = useMemo(() => summaries.filter((s) => s.kind === 'sticker'), [summaries]);
  const signature = list.map(entryKey).join('|');
  const [loaded, setLoaded] = useState<{ signature: string; stickers: BrandSticker[] }>({ signature: '', stickers: [] });
  useEffect(() => {
    if (!list.length) return;
    let live = true;
    void Promise.all(
      list.map((summary) =>
        getLibraryEntry(runtime, summary).then(
          (entry): BrandSticker | null => {
            const content = entry.content as BrandContent;
            return content.kind === 'sticker' ? { summary, entry, dynamic: isDynamicSticker(content) } : null;
          },
          () => null,
        ),
      ),
    ).then((stickers) => {
      if (live) setLoaded({ signature, stickers: stickers.filter((s): s is BrandSticker => s !== null) });
    });
    return () => {
      live = false;
    };
    // signature summarizes list.
  }, [runtime, signature]);
  if (!list.length) return { ready: libraryReady, stickers: EMPTY };
  if (loaded.signature === signature) return { ready: true, stickers: loaded.stickers };
  // The library just gained, lost or changed an entry: until the new batch is read back, show the entries from the previous batch that are still in the library, so the grid does not flash empty.
  const ids = new Set(list.map((summary) => summary.id));
  return { ready: false, stickers: loaded.stickers.filter((sticker) => ids.has(sticker.summary.id)) };
}

const EMPTY: BrandSticker[] = [];
