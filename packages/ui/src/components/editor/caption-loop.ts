import { opaqueBounds } from '../../render/thumbnails.ts';
import type { Rect } from './thumb-scenes.ts';

/**
 * Frames for one lap of an animated caption style card. The card takes frames by “which cell of the lap”: once a cell has been drawn, the render kernel is not called for it again, and the lap just loops as a bitmap.
 *
 * Each cell is cropped to its opaque part before being stored, and cells with identical frames share one copy (a lap with per-word color changes has only a few dozen distinct frames). A card has a byte limit for stored frames: for animations where every cell differs, such as drop-in or bounce, once the store is full the remaining cells are drawn fresh each time. When every cell of a lap is the same frame (no per-word animation), `still` is true and the component stops following the clock.
 */

/** Cells per second: one word per 0.62 seconds, so 15 cells show the drop-in and bounce curve; the clock also picks cells at this rate. */
export const CAPTION_FPS = 15;

/** Maximum bytes of frames stored for one card (a per-word color lap is about 1 MB on high-DPI screens). */
export const LOOP_BUDGET = 2 * 1024 * 1024;

/** One cell: the frame cropped to its opaque part (null if fully transparent), and its position within the cell. */
export interface LoopCell {
  image: ImageData | null;
  at: Rect;
}

export class CaptionLoop {
  /** Length of one lap, in seconds. */
  readonly period: number;
  /** Number of cells in one lap. */
  readonly count: number;
  private readonly budget: number;
  private readonly cells: (LoopCell | undefined)[];
  /** The distinct frames stored, bucketed by digest. */
  private readonly kept = new Map<number, LoopCell[]>();
  private bytes = 0;
  private filled = 0;
  private unique = 0;

  constructor(period: number, budget = LOOP_BUDGET) {
    this.period = period;
    this.budget = budget;
    // Subtract a tiny amount: a float multiply that gives 4.0000000001 must not add an extra cell.
    this.count = Math.max(1, Math.ceil(period * CAPTION_FPS - 1e-9));
    this.cells = new Array<LoopCell | undefined>(this.count);
  }

  /** The cell index within the lap when the clock reaches `seconds` (all cards share one origin, so the same word is spoken at the same moment). */
  index(seconds: number): number {
    const phase = ((seconds % this.period) + this.period) % this.period;
    return Math.min(this.count - 1, Math.floor(phase * CAPTION_FPS));
  }

  /** The moment, in seconds, at which cell n is drawn. */
  time(index: number): number {
    return index / CAPTION_FPS;
  }

  get(index: number): LoopCell | undefined {
    return this.cells[index];
  }

  /** Every cell of the lap has been drawn, and they are all the same frame: it does not move. */
  get still(): boolean {
    return this.filled === this.count && this.unique === 1;
  }

  /**
   * Accepts the full frame drawn for cell n and returns the part to paste. If it matches a stored frame, that copy is shared (cells need not be adjacent: a cell drawn later to fill in one skipped in the first lap because of the clock budget is still recognized). If there is no room to store it, it is not stored and is drawn again next lap.
   */
  put(index: number, image: ImageData): LoopCell {
    const known = this.cells[index];
    if (known) return known;
    const cell = crop(image);
    const key = digest(cell);
    const twin = this.kept.get(key)?.find((other) => sameCell(other, cell));
    if (twin) {
      this.cells[index] = twin;
      this.filled++;
      return twin;
    }
    const size = cell.image ? cell.image.data.byteLength : 0;
    if (this.bytes + size > this.budget) return cell;
    this.cells[index] = cell;
    this.kept.set(key, [...(this.kept.get(key) ?? []), cell]);
    this.bytes += size;
    this.filled++;
    this.unique++;
    return cell;
  }

  /** Drops stored frames when a card scrolls out of view, so off-screen cards do not keep memory. */
  clear(): void {
    this.cells.fill(undefined);
    this.kept.clear();
    this.bytes = 0;
    this.filled = 0;
    this.unique = 0;
  }
}

/** Crops to the opaque part. */
function crop(image: ImageData): LoopCell {
  const bounds = opaqueBounds(image);
  if (!bounds) return { image: null, at: { x: 0, y: 0, width: 0, height: 0 } };
  if (bounds.width === image.width && bounds.height === image.height) return { image, at: bounds };
  const data = new Uint8ClampedArray(bounds.width * bounds.height * 4);
  const row = bounds.width * 4;
  for (let y = 0; y < bounds.height; y++) {
    const from = ((bounds.y + y) * image.width + bounds.x) * 4;
    data.set(image.data.subarray(from, from + row), y * row);
  }
  return { image: new ImageData(data, bounds.width, bounds.height), at: bounds };
}

/** Digest of a cell (FNV-1a, stepping 4 bytes): two cells with different digests are certainly different frames; when the digests match, compare byte by byte. */
function digest(cell: LoopCell): number {
  let hash = Math.imul(0x811c9dc5 ^ cell.at.x, 0x01000193);
  hash = Math.imul(hash ^ cell.at.y, 0x01000193);
  hash = Math.imul(hash ^ cell.at.width, 0x01000193);
  if (!cell.image) return hash;
  const { data } = cell.image;
  const words = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
  for (let i = 0; i < words.length; i++) hash = Math.imul(hash ^ words[i]!, 0x01000193);
  return hash;
}

function sameCell(a: LoopCell, b: LoopCell): boolean {
  if (a.at.x !== b.at.x || a.at.y !== b.at.y || a.at.width !== b.at.width || a.at.height !== b.at.height) return false;
  if (!a.image || !b.image) return a.image === b.image;
  const x = a.image.data;
  const y = b.image.data;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
