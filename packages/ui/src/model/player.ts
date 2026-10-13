import { mediaTimeToSeconds, type AssetRecord, type DocumentRecord, type Id, type Sequence, type VersionRef } from '@cuccut/protocol';
import { captionChips, captionKind } from './caption-tracks.ts';
import { thumbnailGrid, sourceClock, sourceSecondsAt } from './clip-media.ts';
import { durationSeconds } from './editor.ts';

/**
 * Criteria for the editor's full-screen player (prototype model-player.js, player.jsx): when the controls collapse, which second a point on the progress bar is, what each key does,
 * and which subtitles each of the four subtitle modes shows. Pure functions; the UI (components/editor/fullscreen-player.tsx) only draws these conclusions.
 *
 * All times are sequence seconds: segments cut from the editor's timeline take no time (the seam closes up), and the timeline clock is the output clock, so the progress bar and timecode read the playhead.
 */

/** How long to stay idle before the controls collapse (prototype `IDLE_MS`). */
export const IDLE_MS = 3000;
/** How many seconds ←/→ and J/L jump at once. */
export const SEEK_STEP = 5;
export const SEEK_STEP_LONG = 10;
/** Hover preview cell on the progress bar: 160 wide for landscape; portrait is narrowed to match the frame, with a maximum height of 120 (prototype `PREV_W` / `PREV_MAX_H`). */
export const PREVIEW_WIDTH = 160;
export const PREVIEW_MAX_HEIGHT = 120;

/**
 * Three things that “hold the controls up”: dragging the progress bar, a popup being open (menu or key table), and dragging the volume. If any one is true, the idle timer does not hide the controls. The hand is still on the bar, and the bar disappearing is the most annoying kind of “cleverness” in a player.
 */
export function holdingVisible(state: { scrubbing: boolean; popup: boolean; volumeDragging: boolean }): boolean {
  return state.scrubbing || state.popup || state.volumeDragging;
}

/** Whether the controls should collapse: only when playing, the pointer is not on the control bar, nothing is held, and 3 seconds of idle have passed. Paused always stays visible. */
export function chromeHidden(state: { playing: boolean; hovering: boolean; holding: boolean; idleMs: number }): boolean {
  return state.playing && !state.hovering && !state.holding && state.idleMs >= IDLE_MS;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Progress fraction (0–1). Always 0 when the duration is 0 (empty timeline), so there is no NaN from division. */
export function seekFraction(seconds: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return clamp(seconds / duration, 0, 1);
}

/** Horizontal position on the progress bar → seconds (uses only `rect`'s left and width). */
export function timeAt(clientX: number, rect: { left: number; width: number }, duration: number): number {
  if (!(rect.width > 0) || !(duration > 0)) return 0;
  return clamp(((clientX - rect.left) / rect.width) * duration, 0, duration);
}

/** Seek step, clamped to [0, duration]. */
export function stepTime(seconds: number, delta: number, duration: number): number {
  return clamp(seconds + delta, 0, Math.max(0, duration || 0));
}

/** 0–9 jump to 0%–90% of the duration. */
export function percentTime(digit: number, duration: number): number {
  const total = Math.max(0, duration || 0);
  return clamp((digit / 10) * total, 0, total);
}

/** Position of chapter boundaries on the progress bar (0–1). The first chapter's 0 is not drawn; it is the track's start, not a seam. */
export function chapterTicks(chapters: readonly { start: number }[], duration: number): number[] {
  if (!(duration > 0)) return [];
  return chapters.map((c) => c.start).filter((s) => s > 0.01 && s < duration).map((s) => s / duration);
}

/** Size of the hover preview cell: width 160, proportional to the canvas, with portrait height not exceeding 120. */
export function previewSize(canvas: { width: number; height: number }): { width: number; height: number } {
  const ratio = canvas.width > 0 && canvas.height > 0 ? canvas.width / canvas.height : 16 / 9;
  const height = Math.min(PREVIEW_MAX_HEIGHT, Math.round(PREVIEW_WIDTH / ratio));
  return { width: Math.round(height * ratio), height };
}

/**
 * The picture in the progress bar hover bubble: the topmost layer at this moment (highest track `order`) that is enabled, on a visible track, and is a video clip with picture, mapped to the source time of the material.
 * Sequence time is first rounded to about one percent of the duration (the `thumbnailGrid` steps); when the pointer moves a little, the same thumbnail is reused, so a frame is not grabbed for every pixel.
 */
export function seekFrame(
  sequence: Sequence,
  assets: Record<Id, AssetRecord>,
  seconds: number,
): { asset: VersionRef; at: number } | null {
  const fps = sequence.fps;
  const grid = thumbnailGrid(durationSeconds(sequence) / 100);
  const at = Math.floor(seconds / grid) * grid;
  const tracks = new Map(sequence.tracks.map((track) => [track.id, track]));
  let best: { order: number; asset: VersionRef; at: number } | null = null;
  for (const item of sequence.items) {
    if (item.type !== 'video' || !item.enabled) continue;
    const track = tracks.get(item.trackId);
    if (!track?.visible) continue;
    const start = (item.span.fromFrame * fps.den) / fps.num;
    const end = ((item.span.fromFrame + item.span.durationFrames) * fps.den) / fps.num;
    const t = Math.max(start, at);
    if (seconds < start || seconds >= end || (best && best.order > track.order)) continue;
    if (!assets[item.assetRef.id]?.revisions[item.assetRef.revision]?.video) continue;
    const source = item.timeMap.kind === 'hold' ? mediaTimeToSeconds(item.timeMap.sourceAt) : sourceSecondsAt(sourceClock(item.timeMap, start), t);
    best = { order: track.order, asset: item.assetRef, at: Math.max(0, Math.round(source * 1000) / 1000) };
  }
  return best ? { asset: best.asset, at: best.at } : null;
}

/* ---------- Four subtitle modes ---------- */

/**
 * The subtitle mode in fullscreen is a view state, not document editing: choosing “translation only” does not remove the original from the video (that would enter undo and follow export). It only temporarily disables subtitles that should not show, on the sequence sent to the preview.
 * Modes are generated from the subtitles actually on screen: with only the original, “Bilingual” is not offered, since that would be an empty promise.
 */
export type CaptionMode = 'off' | 'source' | 'trans' | 'both';

/** Whether there are original and translated subtitles on screen (track visible, instance enabled). */
export function captionAvailability(sequence: Sequence, documents: Record<Id, DocumentRecord>): { hasSource: boolean; hasTranslation: boolean } {
  const shown = captionChips(sequence, documents).filter((chip) => chip.state === 'on');
  return { hasSource: shown.some((chip) => chip.kind === 'original'), hasTranslation: shown.some((chip) => chip.kind === 'translation') };
}

export function captionModes(hasSource: boolean, hasTranslation: boolean): CaptionMode[] {
  const modes: CaptionMode[] = ['off'];
  if (hasSource) modes.push('source');
  if (hasTranslation) modes.push('trans');
  if (hasSource && hasTranslation) modes.push('both');
  return modes;
}

/** Default mode when entering fullscreen: bilingual if both are present, otherwise whichever is present; off if neither. */
export function defaultCaptionMode(hasSource: boolean, hasTranslation: boolean): CaptionMode {
  if (hasSource && hasTranslation) return 'both';
  if (hasSource) return 'source';
  if (hasTranslation) return 'trans';
  return 'off';
}

/** If the chosen mode is still there, use it (after a subtitle is removed it may be gone); otherwise use the default mode. */
export function effectiveCaptionMode(picked: CaptionMode | null, hasSource: boolean, hasTranslation: boolean): CaptionMode {
  return picked && captionModes(hasSource, hasTranslation).includes(picked) ? picked : defaultCaptionMode(hasSource, hasTranslation);
}

/** C: go to the next mode; if the current mode is not in the table, start from the entry after the table's head. */
export function cycleCaptionMode(current: CaptionMode, hasSource: boolean, hasTranslation: boolean): CaptionMode {
  const modes = captionModes(hasSource, hasTranslation);
  return modes[(Math.max(0, modes.indexOf(current)) + 1) % modes.length]!;
}

/** Whether the original or the translation shows in a given mode. */
export function captionVisible(mode: CaptionMode, kind: 'original' | 'translation'): boolean {
  if (mode === 'off') return false;
  if (mode === 'source') return kind === 'original';
  if (mode === 'trans') return kind === 'translation';
  return true;
}

/** Disable the subtitle instances that should not show under the mode (only stops the enabled ones, never re-adds removed ones); returns unchanged if there is nothing to stop. */
export function captionView(sequence: Sequence, documents: Record<Id, DocumentRecord>, mode: CaptionMode): Sequence {
  let changed = false;
  const items = sequence.items.map((item) => {
    if (item.type !== 'caption' || !item.enabled || captionVisible(mode, captionKind(item.documentId, documents))) return item;
    changed = true;
    return { ...item, enabled: false };
  });
  return changed ? { ...sequence, items } : sequence;
}

/* ---------- Keyboard ---------- */

/**
 * In fullscreen the player takes exclusive hold of the keyboard. The editor layer (delete, copy/paste, arrow keys to nudge elements) has no operable object on the viewing surface, and letting it through would only make people delete things by accident while watching.
 * ⌘ / Ctrl / ⌥ are never taken (left to the system and browser); ⇧ is used only with left/right.
 */
export type PlayerAction =
  | 'play'
  | 'exit'
  | 'back'
  | 'fwd'
  | 'back10'
  | 'fwd10'
  | 'prevChapter'
  | 'nextChapter'
  | 'volUp'
  | 'volDown'
  | 'mute'
  | 'captions'
  | 'start'
  | 'end'
  | 'percent'
  | 'keys';

export interface PlayerKey {
  action: PlayerAction;
  /** Digit of `percent` (0–9). */
  digit?: number;
}

type KeyLike = Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>;

/** Letter keys: match the character first (layouts such as Dvorak go by character), and if it is not recognized, by physical key position (same as the editor's `letterOf`). */
function letterOf(event: KeyLike): string {
  const key = event.key.length === 1 ? event.key.toLowerCase() : '';
  if (/^[a-z]$/.test(key)) return key;
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  return key;
}

const LETTERS: Record<string, PlayerAction> = { k: 'play', f: 'exit', m: 'mute', c: 'captions', j: 'back10', l: 'fwd10' };

export function resolvePlayerKey(event: KeyLike): PlayerKey | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const { key } = event;
  switch (key) {
    case ' ':
      return { action: 'play' };
    case 'Escape':
      return { action: 'exit' };
    case 'ArrowLeft':
      return { action: event.shiftKey ? 'prevChapter' : 'back' };
    case 'ArrowRight':
      return { action: event.shiftKey ? 'nextChapter' : 'fwd' };
    case 'ArrowUp':
      return { action: 'volUp' };
    case 'ArrowDown':
      return { action: 'volDown' };
    case 'Home':
      return { action: 'start' };
    case 'End':
      return { action: 'end' };
    case '?':
      return { action: 'keys' };
  }
  if (/^[0-9]$/.test(key)) return { action: 'percent', digit: Number(key) };
  const letter = LETTERS[letterOf(event)];
  return letter ? { action: letter } : null;
}

/**
 * The key table shown to people (`?`). There is only one key table: the player actually wires `resolvePlayerKey`. The tests feed each row through `probe` to check it, and also scan the keyboard in reverse:
 * any action `resolvePlayerKey` can return that this table does not list is marked red. `also` is the other half of the same row (once ← is listed, → is not listed separately).
 * Descriptions are looked up by `action` in the copy catalog (`keys` of fullscreen-player-copy).
 */
export interface PlayerKeyRow {
  action: PlayerAction;
  also?: PlayerAction[];
  keys: string;
  probe: Partial<KeyLike> & { key: string };
}

export const PLAYER_KEYS: readonly PlayerKeyRow[] = [
  { action: 'play', keys: 'Space / K', probe: { key: ' ' } },
  { action: 'exit', keys: 'Esc / F', probe: { key: 'Escape' } },
  { action: 'back', also: ['fwd'], keys: '← / →', probe: { key: 'ArrowLeft' } },
  { action: 'back10', also: ['fwd10'], keys: 'J / L', probe: { key: 'j' } },
  { action: 'prevChapter', also: ['nextChapter'], keys: '⇧← / ⇧→', probe: { key: 'ArrowLeft', shiftKey: true } },
  { action: 'volUp', also: ['volDown'], keys: '↑ / ↓', probe: { key: 'ArrowUp' } },
  { action: 'mute', keys: 'M', probe: { key: 'm' } },
  { action: 'captions', keys: 'C', probe: { key: 'c' } },
  { action: 'start', also: ['end'], keys: 'Home / End', probe: { key: 'Home' } },
  { action: 'percent', keys: '0 – 9', probe: { key: '5' } },
  { action: 'keys', keys: '?', probe: { key: '?' } },
];
