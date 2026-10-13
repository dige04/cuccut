import { create } from 'zustand';

/**
 * Two requirements placed on open editors from outside the editor tabs (slides, design, design system) (docs/design/slides §8.2, docs/design/canvas §8.2).
 * They find the editor by the tab's `itemKey` (`slides:<targetKey>`, `design:<targetKey>`, `design-system:<targetKey>`):
 *
 * - **Save before sending**: if the editor has edits that are not yet published, have it publish them before the message is sent, so the agent reads the version the user sees.
 *   A tab registers its editor after the editor loads, and unregisters it when unmounted. Documents that are not open do not need to wait.
 * - **Jump to where an annotation is**: clicking an annotation in a sent message first opens (or switches to) the tab for that document.
 *   The tab takes the request after the editor loads, and then jumps.
 */

/** An open editor. `flush` makes it publish, and returns whether it saved. `name` is the document's current name, written into the prompt if it did not save. */
interface Flusher {
  flush(): Promise<boolean>;
  name(): string;
}
const flushers = new Map<string, Set<Flusher>>();

/** A tab registers its editor. Returns an unregister function. */
export function registerEditorFlush(key: string, flusher: Flusher): () => void {
  let set = flushers.get(key);
  if (!set) flushers.set(key, (set = new Set()));
  set.add(flusher);
  return () => {
    set.delete(flusher);
    if (!set.size) flushers.delete(key);
  };
}

/**
 * Have every open editor for these documents publish its changes. Returns the names of the ones that did not save (same names counted once), or empty if all saved.
 * It does not block sending. The caller decides.
 */
export async function flushEditors(keys: Iterable<string>): Promise<string[]> {
  const pending = [...new Set(keys)].flatMap((key) =>
    [...(flushers.get(key) ?? [])].map(async (flusher) => ((await flusher.flush().catch(() => false)) ? null : flusher.name())),
  );
  const failed = (await Promise.all(pending)).filter((name): name is string => name !== null);
  return [...new Set(failed)];
}

/**
 * A pending jump target: `id` is the id of this annotation in the editor, `anchor` is its anchor, and `section` is the design-system section it is in (go to that chapter first).
 * `seq` makes clicking the same place again count as a new request.
 */
export interface EditorReveal {
  id: string;
  anchor: string;
  section?: string;
  seq: number;
}

interface EditorRevealStore {
  reveals: Record<string, EditorReveal>;
  request(key: string, id: string, anchor: string, section?: string): void;
  /** Taken by the tab (cleared after it is taken). */
  take(key: string, seq: number): void;
}

let seq = 0;

export const useEditorReveal = create<EditorRevealStore>()((set) => ({
  reveals: {},
  request: (key, id, anchor, section) =>
    set((s) => ({ reveals: { ...s.reveals, [key]: { id, anchor, ...(section ? { section } : {}), seq: ++seq } } })),
  take: (key, taken) =>
    set((s) => {
      if (s.reveals[key]?.seq !== taken) return {};
      const { [key]: _done, ...reveals } = s.reveals;
      return { reveals };
    }),
}));
