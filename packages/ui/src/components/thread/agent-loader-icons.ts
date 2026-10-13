import * as loader from '@react-spectrum/ai/loader';
import type { Cell } from '@react-spectrum/ai/loader';
import { THINKING, forKind, type LoaderIcon } from '../../model/agent-loader.ts';

/** Name → pixel grid. Check by type: every name in model/agent-loader.ts must be a single graphic exported by this package. */
const TABLE: Record<LoaderIcon, Cell[]> = loader;

/** Keys of the loader graphics: 'thinking' is the generic sequence; the rest are step categories (LoaderKind in model/agent-loader.ts; unrecognised ones fall back to the default). */
export type LoaderKey = 'thinking' | (string & {});

const SEQUENCES = new Map<string, Cell[][] | undefined>();

/**
 * The sequence played for the step that is running and for the turn footer. Cached by key so the array reference stays stable (if PixelLoader gets a new reference it replays from the first frame);
 * when no frame can be obtained, undefined is returned, and PixelLoader uses its default graphic.
 */
export function loaderSequence(key: LoaderKey): Cell[][] | undefined {
  if (!SEQUENCES.has(key)) {
    const names = key === 'thinking' ? THINKING : forKind(key);
    const cells = names.map((name) => TABLE[name]).filter((c) => Array.isArray(c) && c.length > 0);
    SEQUENCES.set(key, cells.length ? cells : undefined);
  }
  return SEQUENCES.get(key);
}
